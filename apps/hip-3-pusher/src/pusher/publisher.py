"""
Oracle publisher for Hyperliquid HIP-3 markets.

This module handles publishing oracle updates to Hyperliquid via the setOracle API.
It supports three signing modes: local key, AWS KMS, and multisig.

PUBLISHING FLOW:
1. Publisher.run() loops continuously with publish_interval sleep
2. Each cycle calls PriceState.get_all_prices() to compute prices via waterfall
3. Prices are formatted for HL API (oracle_pxs, mark_pxs, external_perp_pxs)
4. setOracle API call is made with signed transaction
5. Response is logged and metrics are updated

RATE LIMITING:
Hyperliquid enforces a 2.5s rate limit per oracle update. If publish_interval < 2.5s,
rate limit errors will occur. These are handled gracefully (no error log, just skipped).
"""

import asyncio
import time
from enum import StrEnum
from pathlib import Path
from typing import Any

from eth_account import Account
from eth_account.signers.local import LocalAccount
from hyperliquid.exchange import Exchange
from hyperliquid.utils.signing import get_timestamp_ms, sign_multi_sig_l1_action_payload
from hyperliquid.utils.types import Meta, SpotMeta
from loguru import logger

from pusher.config import Config
from pusher.exception import PushError
from pusher.kms_signer import KMSSigner
from pusher.metrics import Metrics
from pusher.price_state import PriceState


class PushErrorReason(StrEnum):
    """
    Known setOracle push failure modes.

    Used for metrics categorization and targeted error handling.
    Rate limit errors are expected with redundant relayers and are suppressed.
    """

    RATE_LIMIT = "rate_limit"  # 2.5s rate limit - expected with redundant relayers
    USER_LIMIT = "user_limit"  # Per-account quota exceeded - need reserveRequestWeight
    INTERNAL_ERROR = "internal_error"  # Exception thrown internally
    INVALID_NONCE = "invalid_nonce"  # Same ms timestamp used twice
    INVALID_DEPLOYER_ACCOUNT = (
        "invalid_deployer_account"  # Not a valid deployer/sub-deployer
    )
    ACCOUNT_DOES_NOT_EXIST = "account_does_not_exist"  # User not activated on HL
    MISSING_EXTERNAL_PERP_PXS = (
        "missing_external_perp_pxs"  # Required external price missing
    )
    INVALID_DEX = "invalid_dex"  # market_name doesn't match or wrong network
    UNKNOWN = "unknown"  # Uncategorized error string


class Publisher:
    """
    HIP-3 oracle publisher handler

    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-3-deployer-actions
    """

    kms_signer: KMSSigner | None
    oracle_account: LocalAccount | None
    multisig_address: str | None

    def __init__(
        self, config: Config, price_state: PriceState, metrics: Metrics
    ) -> None:
        self.publish_interval = float(config.hyperliquid.publish_interval)
        self.use_testnet = config.hyperliquid.use_testnet
        self.push_urls = config.hyperliquid.push_urls
        logger.info("push urls: {}", self.push_urls)

        self.kms_signer = None
        self.enable_kms = False
        self.oracle_account = None
        self.user_limit_address = ""  # Will be set below
        if not config.kms.enable_kms:
            oracle_pusher_key_path = config.hyperliquid.oracle_pusher_key_path
            if oracle_pusher_key_path is None:
                raise ValueError(
                    "oracle_pusher_key_path is required when KMS is not enabled"
                )
            oracle_pusher_key = Path(oracle_pusher_key_path).read_text().strip()
            self.oracle_account = Account.from_key(oracle_pusher_key)
            logger.info("oracle pusher local pubkey: {}", self.oracle_account.address)
            self.user_limit_address = self.oracle_account.address
        self.publisher_exchanges = [
            Exchange(
                wallet=self.oracle_account,
                base_url=url,
                timeout=config.hyperliquid.publish_timeout,
                meta=Meta(universe=[]),
                spot_meta=SpotMeta(universe=[], tokens=[]),
            )
            for url in (self.push_urls or [])
        ]
        if config.kms.enable_kms:
            # TODO: Add KMS/multisig support
            if config.multisig.enable_multisig:
                raise Exception("KMS/multisig not yet supported")

            self.enable_kms = True
            self.kms_signer = KMSSigner(config, self.publisher_exchanges)
            self.user_limit_address = self.kms_signer.address

        if config.multisig.enable_multisig:
            multisig_addr = config.multisig.multisig_address
            if not multisig_addr:
                raise Exception("Multisig enabled but missing multisig address")
            self.multisig_address = multisig_addr
            self.user_limit_address = multisig_addr
        else:
            self.multisig_address = None

        self.market_name = config.hyperliquid.market_name
        self.enable_publish = config.hyperliquid.enable_publish

        self.price_state = price_state
        self.metrics = metrics
        self.metrics_labels = {"dex": self.market_name}
        self.last_push_time = time.time()

    async def run(self) -> None:
        while True:
            await asyncio.sleep(self.publish_interval)
            try:
                await self.publish()
            except Exception as e:
                logger.exception("Publisher.publish() exception: {}", repr(e))

    async def publish(self) -> None:
        oracle_update = self.price_state.get_all_prices()
        logger.debug("oracle_update: {}", oracle_update)

        oracle_pxs, mark_pxs_raw, external_perp_pxs = (
            oracle_update.oracle,
            oracle_update.mark,
            oracle_update.external,
        )
        if not oracle_pxs:
            logger.error("No valid oracle prices available")
            self.metrics.no_oracle_price_counter.add(1, self.metrics_labels)

        # markPxs is a list of dicts of length 0-2, and so can be empty.
        mark_pxs = self.construct_mark_pxs(mark_pxs_raw)

        if self.enable_publish:
            try:
                if self.enable_kms:
                    if self.kms_signer is None:
                        raise ValueError("KMS signer not initialized")
                    push_response = self.kms_signer.set_oracle(
                        dex=self.market_name,
                        oracle_pxs=oracle_pxs,
                        all_mark_pxs=mark_pxs,
                        external_perp_pxs=external_perp_pxs,
                    )
                elif self.multisig_address:
                    push_response = await self._send_multisig_update(
                        oracle_pxs=oracle_pxs,
                        all_mark_pxs=mark_pxs,
                        external_perp_pxs=external_perp_pxs,
                    )
                else:
                    push_response = await self._send_update(
                        oracle_pxs=oracle_pxs,
                        all_mark_pxs=mark_pxs,
                        external_perp_pxs=external_perp_pxs,
                    )
                self._handle_response(push_response, list(oracle_pxs.keys()))
            except PushError:
                logger.error("Push API call failed")
                self._update_attempts_total(
                    "error", PushErrorReason.INTERNAL_ERROR, list(oracle_pxs.keys())
                )
                pass
            except Exception as e:
                logger.exception("Unexpected exception in push request: {}", repr(e))
                self._update_attempts_total(
                    "error", PushErrorReason.INTERNAL_ERROR, list(oracle_pxs.keys())
                )
        else:
            logger.debug("push disabled")

        self._record_push_interval_metric()

    async def _send_update(
        self,
        oracle_pxs: dict[str, str],
        all_mark_pxs: list[dict[str, Any]],
        external_perp_pxs: dict[str, str],
    ) -> dict[str, Any]:
        for exchange in self.publisher_exchanges:
            try:
                return await asyncio.to_thread(
                    self._request_single,
                    exchange,
                    oracle_pxs,
                    all_mark_pxs,
                    external_perp_pxs,
                )
            except Exception as e:
                logger.exception(
                    "perp_deploy_set_oracle exception for endpoint: {} error: {}",
                    exchange.base_url,
                    repr(e),
                )

        raise PushError("all push endpoints failed")

    def _request_single(
        self,
        exchange: Exchange,
        oracle_pxs: dict[str, str],
        all_mark_pxs: list[dict[str, Any]],
        external_perp_pxs: dict[str, str],
    ) -> dict[str, Any]:
        result: dict[str, Any] = exchange.perp_deploy_set_oracle(
            dex=self.market_name,
            oracle_pxs=oracle_pxs,
            all_mark_pxs=all_mark_pxs,
            external_perp_pxs=external_perp_pxs,
        )
        return result

    def _handle_response(self, response: dict[str, Any], symbols: list[str]) -> None:
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
            response_data = response.get("response")
            if isinstance(response_data, dict):
                ok_data = response_data.get("data")
                if ok_data:
                    logger.info("ok response data: {}", ok_data)
        elif status == "err":
            error_reason = self._get_error_reason(response)
            self._update_attempts_total("error", error_reason, symbols)
            if error_reason != "rate_limit":
                logger.error("Error response: {}", response)

    def _record_push_interval_metric(self) -> None:
        now = time.time()
        push_interval = now - self.last_push_time
        self.metrics.push_interval_histogram.record(push_interval, self.metrics_labels)
        self.last_push_time = now
        logger.debug("Push interval: {}", push_interval)

    async def _send_multisig_update(
        self,
        oracle_pxs: dict[str, str],
        all_mark_pxs: list[dict[str, Any]],
        external_perp_pxs: dict[str, str],
    ) -> dict[str, Any]:
        for exchange in self.publisher_exchanges:
            try:
                return await self._send_single_multisig_update(
                    exchange=exchange,
                    oracle_pxs=oracle_pxs,
                    all_mark_pxs=all_mark_pxs,
                    external_perp_pxs=external_perp_pxs,
                )
            except Exception as e:
                logger.exception(
                    "_send_single_multisig_update exception for endpoint: {} error: {}",
                    exchange.base_url,
                    repr(e),
                )

        raise PushError("all push endpoints failed for multisig")

    async def _send_single_multisig_update(
        self,
        exchange: Exchange,
        oracle_pxs: dict[str, str],
        all_mark_pxs: list[dict[str, Any]],
        external_perp_pxs: dict[str, str],
    ) -> dict[str, Any]:
        if self.oracle_account is None:
            raise ValueError("Oracle account not initialized for multisig")
        timestamp = get_timestamp_ms()
        oracle_pxs_wire = sorted(oracle_pxs.items())
        mark_pxs_wire = [sorted(mark_pxs.items()) for mark_pxs in all_mark_pxs]
        external_perp_pxs_wire = sorted(external_perp_pxs.items())
        action = {
            "type": "perpDeploy",
            "setOracle": {
                "dex": self.market_name,
                "oraclePxs": oracle_pxs_wire,
                "markPxs": mark_pxs_wire,
                "externalPerpPxs": external_perp_pxs_wire,
            },
        }
        signatures = [
            sign_multi_sig_l1_action_payload(
                wallet=self.oracle_account,
                action=action,
                is_mainnet=not self.use_testnet,
                vault_address=None,
                timestamp=timestamp,
                expires_after=None,
                payload_multi_sig_user=self.multisig_address,
                outer_signer=self.oracle_account.address,
            )
        ]
        return await asyncio.to_thread(
            self._request_multi_sig, exchange, action, signatures, timestamp
        )

    def _request_multi_sig(
        self,
        exchange: Exchange,
        action: dict[str, Any],
        signatures: list[dict[str, Any]],
        timestamp: int,
    ) -> dict[str, Any]:
        result: dict[str, Any] = exchange.multi_sig(
            self.multisig_address, action, signatures, timestamp
        )
        return result

    def _update_attempts_total(
        self, status: str, error_reason: PushErrorReason | None, symbols: list[str]
    ) -> None:
        labels = {**self.metrics_labels, "status": status}
        if error_reason:
            # don't flag rate limiting as this is expected with redundancy
            if error_reason == "rate_limit":
                return
            labels["error_reason"] = error_reason

        for symbol in symbols:
            labels["symbol"] = symbol
            self.metrics.update_attempts_total.add(1, labels)

    def _get_error_reason(self, response: dict[str, Any]) -> PushErrorReason | None:
        response_str = response.get("response")
        if not response_str:
            return None
        if not isinstance(response_str, str):
            return PushErrorReason.UNKNOWN
        if "Oracle price update too often" in response_str:
            return PushErrorReason.RATE_LIMIT
        elif "Too many cumulative requests" in response_str:
            return PushErrorReason.USER_LIMIT
        elif "Invalid nonce" in response_str:
            return PushErrorReason.INVALID_NONCE
        elif "externalPerpPxs missing perp" in response_str:
            return PushErrorReason.MISSING_EXTERNAL_PERP_PXS
        elif "Invalid perp deployer or sub-deployer" in response_str:
            return PushErrorReason.INVALID_DEPLOYER_ACCOUNT
        elif "User or API Wallet" in response_str:
            return PushErrorReason.ACCOUNT_DOES_NOT_EXIST
        elif "Invalid perp DEX" in response_str:
            return PushErrorReason.INVALID_DEX
        else:
            logger.warning("Unrecognized error response: {}", response_str)
            return PushErrorReason.UNKNOWN

    def construct_mark_pxs(self, mark_pxs: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Transform mark prices into the format required by Hyperliquid's setOracle API.

        HYPERLIQUID MARK PRICE CALCULATION:
        The API accepts markPxs as a list of 0-2 dictionaries. Hyperliquid then
        calculates the final mark price as:
            new_mark = median(markPxs[0], markPxs[1], local_mark)
        where local_mark = median(best_bid, best_ask, last_trade).

        Input formats handled:
        - Single price: {"pyth:BTC": "65000.0"} -> [{"pyth:BTC": "65000.0"}]
        - Dual prices: {"pyth:BTC": ["65000.0", "64999.5"]} -> [{"pyth:BTC": "65000.0"}, {"pyth:BTC": "64999.5"}]

        The dual-price format comes from session_ema source type which exploits
        the median calculation:
        - Off hours: [oracle, oracle] forces median = oracle (appears twice)
        - Market hours: [oracle, ema] lets all three values influence the median

        Returns:
            List of 0-2 dicts, each mapping symbol -> price string
        """
        if not mark_pxs:
            return []
        val: list[dict[str, Any]] = [{}]
        for symbol, px in mark_pxs.items():
            if isinstance(px, list):
                # Session EMA returns [oracle_price, ema_price] - expand to 2 dicts
                while len(val) < len(px):
                    val.append({})
                for i, pxi in enumerate(px):
                    val[i][symbol] = pxi
            else:
                # Single mark price - goes in first dict
                val[0][symbol] = px
        logger.debug("construct_mark_pxs: {}", val)
        return val
