import asyncio
import time

from loguru import logger
from pathlib import Path

from eth_account import Account
from eth_account.signers.local import LocalAccount
from hyperliquid.exchange import Exchange
from hyperliquid.utils.signing import get_timestamp_ms, sign_multi_sig_l1_action_payload

from pusher.config import Config
from pusher.exception import PushError
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
        logger.info("push urls: {}", self.push_urls)

        self.kms_signer = None
        self.enable_kms = False
        self.oracle_account = None
        if not config.kms.enable_kms:
            oracle_pusher_key = Path(config.hyperliquid.oracle_pusher_key_path).read_text().strip()
            self.oracle_account: LocalAccount = Account.from_key(oracle_pusher_key)
            logger.info("oracle pusher local pubkey: {}", self.oracle_account.address)
        self.publisher_exchanges = [Exchange(wallet=self.oracle_account,
                                             base_url=url,
                                             timeout=config.hyperliquid.publish_timeout)
                                    for url in self.push_urls]
        if config.kms.enable_kms:
            # TODO: Add KMS/multisig support
            if config.multisig.enable_multisig:
                raise Exception("KMS/multisig not yet supported")

            self.enable_kms = True
            self.kms_signer = KMSSigner(config, self.publisher_exchanges)

        if config.multisig.enable_multisig:
            if not config.multisig.multisig_address:
                raise Exception("Multisig enabled but missing multisig address")
            self.multisig_address = config.multisig.multisig_address

        self.market_name = config.hyperliquid.market_name
        self.enable_publish = config.hyperliquid.enable_publish

        self.price_state = price_state
        self.metrics = metrics
        self.metrics_labels = {"dex": self.market_name}
        self.last_push_time = time.time()

    async def run(self):
        while True:
            await asyncio.sleep(self.publish_interval)
            try:
                self.publish()
            except Exception as e:
                logger.exception("Publisher.publish() exception: {}", repr(e))

    def publish(self):
        oracle_update = self.price_state.get_all_prices()
        logger.debug("oracle_update: {}", oracle_update)

        oracle_pxs, mark_pxs, external_perp_pxs = oracle_update.oracle, oracle_update.mark, oracle_update.external
        if not oracle_pxs:
            logger.error("No valid oracle prices available")
            self.metrics.no_oracle_price_counter.add(1, self.metrics_labels)
        # markPxs is a list of dicts of length 0-2, and so can be empty
        mark_pxs = [mark_pxs] if mark_pxs else []

        # TODO: "Each update can change oraclePx and markPx by at most 1%."
        # TODO: "The markPx cannot be updated such that open interest would be 10x the open interest cap."

        if self.enable_publish:
            try:
                if self.enable_kms:
                    push_response = self.kms_signer.set_oracle(
                        dex=self.market_name,
                        oracle_pxs=oracle_pxs,
                        all_mark_pxs=mark_pxs,
                        external_perp_pxs=external_perp_pxs,
                    )
                elif self.multisig_address:
                    push_response = self._send_multisig_update(
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
            except PushError:
                logger.error("All push attempts failed")
                self.metrics.failed_push_counter.add(1, self.metrics_labels)
            except Exception as e:
                logger.exception("Unexpected exception in push request: {}", repr(e))
        else:
            logger.debug("push disabled")

        self._record_push_interval_metric()

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

        raise PushError("all push endpoints failed")

    def _handle_response(self, response):
        logger.debug("oracle update response: {}", response)
        status = response.get("status")
        if status == "ok":
            self.metrics.successful_push_counter.add(1, self.metrics_labels)
        elif status == "err":
            self.metrics.failed_push_counter.add(1, self.metrics_labels)
            logger.error("oracle update error response: {}", response)

    def _record_push_interval_metric(self):
        now = time.time()
        push_interval = now - self.last_push_time
        self.metrics.push_interval_histogram.record(push_interval, self.metrics_labels)
        self.last_push_time = now
        logger.debug("Push interval: {}", push_interval)

    def _send_multisig_update(self, oracle_pxs, all_mark_pxs, external_perp_pxs):
        for exchange in self.publisher_exchanges:
            try:
                return self._send_single_multisig_update(
                    exchange=exchange,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=all_mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )
            except Exception as e:
                logger.exception("_send_single_multisig_update exception for endpoint: {} error: {}", exchange.base_url, repr(e))

        raise PushError("all push endpoints failed for multisig")

    def _send_single_multisig_update(self, exchange, oracle_pxs, all_mark_pxs, external_perp_pxs):
        timestamp = get_timestamp_ms()
        oracle_pxs_wire = sorted(list(oracle_pxs.items()))
        mark_pxs_wire = [sorted(list(mark_pxs.items())) for mark_pxs in all_mark_pxs]
        external_perp_pxs_wire = sorted(list(external_perp_pxs.items()))
        action = {
            "type": "perpDeploy",
            "setOracle": {
                "dex": self.market_name,
                "oraclePxs": oracle_pxs_wire,
                "markPxs": mark_pxs_wire,
                "externalPerpPxs": external_perp_pxs_wire,
            },
        }
        signatures = [sign_multi_sig_l1_action_payload(
            wallet=self.oracle_account,
            action=action,
            is_mainnet=not self.use_testnet,
            vault_address=None,
            timestamp=timestamp,
            expires_after=None,
            payload_multi_sig_user=self.multisig_address,
            outer_signer=self.oracle_account.address,
        )]
        return exchange.multi_sig(self.multisig_address, action, signatures, timestamp)
