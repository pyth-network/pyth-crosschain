import asyncio
from loguru import logger
from pathlib import Path

from eth_account import Account
from eth_account.signers.local import LocalAccount
from hyperliquid.exchange import Exchange

from pusher.config import Config
from pusher.kms_signer import KMSSigner
from pusher.metrics import Metrics
from pusher.price_state import PriceState


class Publisher:
    """
    HIP-3 oracle publisher handler

    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-3-deployer-actions
    """
    def __init__(self, config: Config, price_state: PriceState, metrics: Metrics):
        self.publish_interval = float(config.hyperliquid.publish_interval)
        self.use_testnet = config.hyperliquid.use_testnet
        self.push_urls = config.hyperliquid.push_urls

        self.kms_signer = None
        self.enable_kms = False
        oracle_account = None
        if not config.kms.enable_kms:
            oracle_pusher_key = Path(config.hyperliquid.oracle_pusher_key_path).read_text().strip()
            oracle_account: LocalAccount = Account.from_key(oracle_pusher_key)
            logger.info("oracle pusher local pubkey: {}", oracle_account.address)
        self.publisher_exchanges = [Exchange(wallet=oracle_account, base_url=url) for url in self.push_urls]
        if config.kms.enable_kms:
            self.enable_kms = True
            self.kms_signer = KMSSigner(config, self.publisher_exchanges)

        self.market_name = config.hyperliquid.market_name
        self.market_symbol = config.hyperliquid.market_symbol
        self.enable_publish = config.hyperliquid.enable_publish

        self.price_state = price_state
        self.metrics = metrics
        self.metrics_labels = {"dex": self.market_name}

    async def run(self):
        while True:
            await asyncio.sleep(self.publish_interval)
            try:
                self.publish()
            except Exception as e:
                logger.exception("Publisher.publish() exception: {}", repr(e))

    def publish(self):
        oracle_pxs = {}
        oracle_px = self.price_state.get_current_oracle_price()
        if not oracle_px:
            logger.error("No valid oracle price available")
            self.metrics.no_oracle_price_counter.add(1, self.metrics_labels)
            return
        else:
            logger.debug("Current oracle price: {}", oracle_px)
            oracle_pxs[self.market_symbol] = oracle_px

        mark_pxs = []
        external_perp_pxs = {}
        if self.price_state.hl_mark_price:
            external_perp_pxs[self.market_symbol] = self.price_state.hl_mark_price.price

        # TODO: "Each update can change oraclePx and markPx by at most 1%."
        # TODO: "The markPx cannot be updated such that open interest would be 10x the open interest cap."

        push_response = None
        if self.enable_publish:
            if self.enable_kms:
                push_response = self.kms_signer.set_oracle(
                    dex=self.market_name,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )
            else:
                push_response = self._send_update(
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )

        self._handle_response(push_response)

    def _send_update(self, oracle_pxs, all_mark_pxs, external_perp_pxs):
        for exchange in self.publisher_exchanges:
            try:
                return exchange.perp_deploy_set_oracle(
                    dex=self.market_name,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=all_mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )
            except Exception as e:
                logger.exception("perp_deploy_set_oracle exception for endpoint: {} error: {}", exchange.base_url, repr(e))

        return None

    def _handle_response(self, response):
        if response is None:
            logger.error("Push API call failed")
            self.metrics.failed_push_counter.add(1, self.metrics_labels)
            return

        logger.debug("publish: push response: {} {}", response, type(response))
        status = response.get("status")
        if status == "ok":
            self.metrics.successful_push_counter.add(1, self.metrics_labels)
        elif status == "err":
            self.metrics.failed_push_counter.add(1, self.metrics_labels)
            logger.error("publish: publish error: {}", response)
