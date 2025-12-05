import asyncio
from enum import StrEnum
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


class PushErrorReason(StrEnum):
    """ setOracle push failure modes """
    # 2.5s rate limit reject, expected with redundant relayers
    RATE_LIMIT = "rate_limit"
    # Per-account limit, need to purchase more transactions with reserveRequestWeight
    USER_LIMIT = "user_limit"
    # Some exception thrown internally
    INTERNAL_ERROR = "internal_error"
    # Invalid nonce, if the pusher account pushes multiple transactions with the same ms timestamp
    INVALID_NONCE = "invalid_nonce"
    # Some error string we haven't categorized yet
    UNKNOWN = "unknown"


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
        else:
            self.multisig_address = None

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
                self._handle_response(push_response, list(oracle_pxs.keys()))
            except PushError:
                # since rate limiting is expected, don't necessarily log
                pass
            except Exception as e:
                logger.exception("Unexpected exception in push request: {}", repr(e))
                self._update_attempts_total("error", PushErrorReason.INTERNAL_ERROR, list(oracle_pxs.keys()))
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

    def _handle_response(self, response, symbols: list[str]):
        logger.debug("oracle update response: {}", response)
        status = response.get("status")
        if status == "ok":
            self._update_attempts_total("success", None, symbols)
            time_secs = int(time.time())

            # update last publish time for each symbol in dex
            for symbol in symbols:
                labels = {**self.metrics_labels, "symbol": symbol}
                self.metrics.last_pushed_time.set(time_secs, labels)

            # log any data in the ok response (likely price clamping issues)
            ok_data = response.get("response", {}).get("data")
            if ok_data:
                logger.info("ok response data: {}", ok_data)
        elif status == "err":
            error_reason = self._get_error_reason(response)
            self._update_attempts_total("error", error_reason, symbols)
            if error_reason != "rate_limit":
                logger.error("Error response: {}", response)

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

    def _update_attempts_total(self, status: str, error_reason: str | None, symbols: list[str]):
        labels = {**self.metrics_labels, "status": status}
        if error_reason:
            # don't flag rate limiting as this is expected with redundancy
            if error_reason == "rate_limit":
                return
            labels["error_reason"] = error_reason

        for symbol in symbols:
            labels["symbol"] = symbol
            self.metrics.update_attempts_total.add(1, labels)

    def _get_error_reason(self, response):
        response = response.get("response")
        if not response:
            return None
        elif "Oracle price update too often" in response:
            return PushErrorReason.RATE_LIMIT
        elif "Too many cumulative requests" in response:
            return PushErrorReason.USER_LIMIT
        elif "Invalid nonce" in response:
            return PushErrorReason.INVALID_NONCE
        else:
            logger.warning("Unrecognized error response: {}", response)
            return PushErrorReason.UNKNOWN
