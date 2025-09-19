import asyncio

from loguru import logger

from eth_account import Account
from eth_account.signers.local import LocalAccount
from hyperliquid.exchange import Exchange
from hyperliquid.utils.constants import TESTNET_API_URL, MAINNET_API_URL

from kms_signer import KMSSigner
from metrics import Metrics
from price_state import PriceState


class Publisher:
    """
    HIP-3 oracle publisher handler

    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-3-deployer-actions
    """
    def __init__(self, config: dict, price_state: PriceState, metrics: Metrics):
        self.publish_interval = float(config["hyperliquid"]["publish_interval"])
        self.kms_signer = None
        self.enable_kms = False
        self.use_testnet = config["hyperliquid"].get("use_testnet", True)

        if config["kms"]["enable_kms"]:
            self.enable_kms = True
            oracle_account = None
            kms_key_path = config["kms"]["key_path"]
            kms_key_id = open(kms_key_path, "r").read().strip()
            self.kms_signer = KMSSigner(kms_key_id, config["kms"]["aws_region_name"], self.use_testnet)
        else:
            oracle_pusher_key_path = config["hyperliquid"]["oracle_pusher_key_path"]
            oracle_pusher_key = open(oracle_pusher_key_path, "r").read().strip()
            oracle_account: LocalAccount = Account.from_key(oracle_pusher_key)
            del oracle_pusher_key
            logger.info("oracle pusher local pubkey: {}", oracle_account.address)

        url = TESTNET_API_URL if self.use_testnet else MAINNET_API_URL
        self.oracle_publisher_exchange: Exchange = Exchange(wallet=oracle_account, base_url=url)
        self.market_name = config["hyperliquid"]["market_name"]
        self.market_symbol = config["hyperliquid"]["market_symbol"]
        self.enable_publish = config["hyperliquid"].get("enable_publish", False)

        self.price_state = price_state
        self.metrics = metrics

    async def run(self):
        while True:
            await asyncio.sleep(self.publish_interval)
            try:
                self.publish()
            except Exception as e:
                logger.exception("Publisher.publish() exception: {}", e)

    def publish(self):
        oracle_pxs = {}
        oracle_px = self.price_state.get_current_oracle_price()
        if not oracle_px:
            logger.error("No valid oracle price available")
            self.metrics.no_oracle_price_counter.add(1)
            return
        else:
            logger.debug("Current oracle price: {}", oracle_px)
            oracle_pxs[self.market_symbol] = oracle_px

        mark_pxs = []
        #if self.price_state.hl_mark_price:
        #    mark_pxs.append({self.market_symbol: self.price_state.hl_mark_price})

        external_perp_pxs = {}

        if self.enable_publish:
            if self.enable_kms:
                push_response = self.kms_signer.set_oracle(
                    dex=self.market_name,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )
            else:
                push_response = self.oracle_publisher_exchange.perp_deploy_set_oracle(
                    dex=self.market_name,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )

            # TODO: Look at specific error responses and log/alert accordingly
            logger.debug("publish: push response: {} {}", push_response, type(push_response))
            status = push_response.get("status", "")
            if status == "ok":
                self.metrics.successful_push_counter.add(1)
            elif status == "err":
                self.metrics.failed_push_counter.add(1)
                logger.error("publish: publish error: {}", push_response)
