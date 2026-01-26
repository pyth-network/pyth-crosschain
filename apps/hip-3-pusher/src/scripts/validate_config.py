#!/usr/bin/env python3
"""
Configuration validation and dry-run CLI tool.

This script validates a HIP-3 pusher configuration file and tests all data sources
without actually publishing to Hyperliquid. Use this in CI to validate config changes.

Usage:
    uv run python -m scripts.validate_config -c config/config.toml

What it does:
1. Validates config structure using pydantic
2. Tests SEDA endpoints by polling them and returning values
3. Tests Lazer WebSocket by connecting and receiving prices
4. Tests Hermes WebSocket by connecting and receiving prices
5. Reports on all configured price sources
6. Exits with code 0 on success, non-zero on failure
"""

import argparse
import asyncio
import json
import os
import sys
import tomllib
from dataclasses import dataclass
from typing import Any

import httpx
import websockets
from loguru import logger
from pydantic import ValidationError

from pusher.config import (
    Config,
    ConstantSourceConfig,
    OracleMidAverageConfig,
    PairSourceConfig,
    PriceSourceConfig,
    SessionEMASourceConfig,
    SingleSourceConfig,
)
from pusher.exception import StaleConnectionError
from pusher.hermes_listener import HermesListener
from pusher.lazer_listener import LazerListener
from pusher.price_state import PriceSourceState
from pusher.seda_listener import SedaListener

# Timeout for receiving WebSocket messages during validation
WS_RECEIVE_TIMEOUT_SECONDS = 10

# Standard Pyth price exponent (prices are scaled by 10^exponent)
# Most Pyth feeds use -8, meaning raw_price * 10^-8 = USD price
PYTH_DEFAULT_EXPONENT = -8


@dataclass
class ValidationResult:
    """Result of a validation check."""

    success: bool
    message: str
    details: dict[str, Any] | None = None


class ConfigValidator:
    """Validates HIP-3 pusher configuration and tests data sources."""

    def __init__(self, config_path: str, seda_api_key: str | None = None) -> None:
        self.config_path = config_path
        self.seda_api_key = seda_api_key
        self.config: Config | None = None
        self.results: list[ValidationResult] = []

    def validate_all(self) -> bool:
        """Run all validations and return True if all passed."""
        # Step 1: Load and validate config structure
        if not self._validate_config_structure():
            return False

        assert self.config is not None

        # Step 2: Report on configured sources
        self._report_configured_sources()

        # Step 3-5: Test all data sources
        asyncio.run(self._test_all_sources())

        # Summary
        return self._print_summary()

    async def _test_all_sources(self) -> None:
        """Test all configured data sources."""
        assert self.config is not None

        # Test SEDA (HTTP)
        await self._test_seda_endpoints()

        # Test Lazer (WebSocket)
        await self._test_lazer_endpoint()

        # Test Hermes (WebSocket)
        await self._test_hermes_endpoint()

    def _validate_config_structure(self) -> bool:
        """Validate the config file structure using pydantic."""
        logger.info("=" * 60)
        logger.info("STEP 1: Validating config structure")
        logger.info("=" * 60)

        try:
            with open(self.config_path, "rb") as f:
                config_toml = tomllib.load(f)

            self.config = Config(**config_toml)
            self.results.append(
                ValidationResult(
                    success=True,
                    message="Config structure is valid",
                    details={"path": self.config_path},
                )
            )
            logger.success("✓ Config structure is valid")
            return True

        except FileNotFoundError:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Config file not found: {self.config_path}",
                )
            )
            logger.error("✗ Config file not found: {}", self.config_path)
            return False

        except tomllib.TOMLDecodeError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Invalid TOML syntax: {e}",
                )
            )
            logger.error("✗ Invalid TOML syntax: {}", e)
            return False

        except ValidationError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Config validation failed: {e}",
                    details={"errors": e.errors()},
                )
            )
            logger.error("✗ Config validation failed:")
            for error in e.errors():
                loc = ".".join(str(x) for x in error["loc"])
                logger.error("  - {}: {}", loc, error["msg"])
            return False

    def _report_configured_sources(self) -> None:
        """Report what price sources are configured."""
        assert self.config is not None

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 2: Configured price sources")
        logger.info("=" * 60)

        price_config = self.config.price

        # Oracle prices
        if price_config.oracle:
            logger.info("Oracle prices:")
            for symbol, sources in price_config.oracle.items():
                source_names = [self._describe_source(s) for s in sources]
                logger.info("  {} -> [{}]", symbol, ", ".join(source_names))

        # Mark prices
        if price_config.mark:
            logger.info("Mark prices:")
            for symbol, sources in price_config.mark.items():
                source_names = [self._describe_source(s) for s in sources]
                logger.info("  {} -> [{}]", symbol, ", ".join(source_names))

        # External prices
        if price_config.external:
            logger.info("External prices:")
            for symbol, sources in price_config.external.items():
                source_names = [self._describe_source(s) for s in sources]
                logger.info("  {} -> [{}]", symbol, ", ".join(source_names))

    def _describe_source(self, source: PriceSourceConfig) -> str:
        """Get a human-readable description of a price source config."""
        if isinstance(source, SingleSourceConfig):
            return f"{source.source.source_name}:{source.source.source_id}"
        elif isinstance(source, PairSourceConfig):
            return f"{source.base_source.source_name}:{source.base_source.source_id}/{source.quote_source.source_name}:{source.quote_source.source_id}"
        elif isinstance(source, ConstantSourceConfig):
            return f"constant:{source.value}"
        elif isinstance(source, OracleMidAverageConfig):
            return f"oracle_mid_average:{source.symbol}"
        elif isinstance(source, SessionEMASourceConfig):
            return f"session_ema:{source.oracle_source.source_id}"
        return "unknown"

    # =========================================================================
    # SEDA Testing (HTTP polling)
    # =========================================================================

    async def _test_seda_endpoints(self) -> None:
        """Test SEDA endpoints by polling them once.

        Uses the actual SedaListener class methods:
        - poll_single_feed(): polls a single feed and parses the result
        - get_parsed_result(): retrieves parsed data from state
        """
        assert self.config is not None

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 3: Testing SEDA endpoints")
        logger.info("=" * 60)

        seda_config = self.config.seda
        if not seda_config.feeds:
            logger.info("No SEDA feeds configured, skipping")
            return

        # Check for API key
        if not self.seda_api_key and not seda_config.api_key_path:
            self.results.append(
                ValidationResult(
                    success=False,
                    message="SEDA API key not provided (use --seda-api-key or configure api_key_path)",
                )
            )
            logger.error(
                "✗ SEDA API key not provided. Use --seda-api-key flag or configure api_key_path"
            )
            return

        seda_state = PriceSourceState("seda_validation")
        seda_last_state = PriceSourceState("seda_last_validation")
        seda_ema_state = PriceSourceState("seda_ema_validation")

        listener = SedaListener(
            self.config,
            seda_state,
            seda_last_state,
            seda_ema_state,
            api_key_override=self.seda_api_key,
        )

        if not listener.api_key:
            self.results.append(
                ValidationResult(
                    success=False,
                    message="SEDA API key not provided or could not be read",
                )
            )
            logger.error("✗ SEDA API key not available")
            return

        logger.info("SEDA URL: {}", listener.url)
        logger.info("Testing {} feed(s)...", len(seda_config.feeds))

        # Test each feed using listener's poll method
        async with httpx.AsyncClient(timeout=listener.poll_timeout) as client:
            for feed_name, feed_config in seda_config.feeds.items():
                await self._test_single_seda_feed(
                    client, listener, feed_name, feed_config
                )

    async def _test_single_seda_feed(
        self,
        client: httpx.AsyncClient,
        listener: SedaListener,
        feed_name: str,
        feed_config: "SedaListener",
    ) -> None:
        """Test a single SEDA feed using listener's poll method."""
        from pusher.config import SedaFeedConfig

        feed_config_typed: SedaFeedConfig = feed_config  # type: ignore

        logger.info("")
        logger.info("  Feed: {}", feed_name)
        logger.info("    Program ID: {}", feed_config_typed.exec_program_id)

        # Validate exec_inputs JSON before polling
        try:
            json.loads(feed_config_typed.exec_inputs)
            logger.info("    Exec inputs: valid JSON")
        except json.JSONDecodeError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"SEDA feed {feed_name} has invalid exec_inputs JSON: {e}",
                )
            )
            logger.error("    ✗ Exec inputs: invalid JSON - {}", e)
            return

        # Use listener's poll_single_feed method
        result = await listener.poll_single_feed(client, feed_name, feed_config_typed)

        if result["ok"]:
            # Get parsed result from state
            parsed = listener.get_parsed_result(feed_name)
            if parsed:
                logger.success("    ✓ Poll successful")
                logger.info("      Price ({}):", listener.price_field)
                logger.info("        {}", parsed["price"])
                logger.info("      Timestamp ({}):", listener.timestamp_field)
                logger.info("        {}", parsed["timestamp"])

                if listener.session_flag_field:
                    logger.info("      Session flag ({}):", listener.session_flag_field)
                    logger.info("        {}", parsed["session_flag"])

                if listener.last_price_field:
                    logger.info("      Last price ({}):", listener.last_price_field)
                    logger.info("        {}", parsed.get("last_price"))

                if listener.session_mark_px_ema_field:
                    logger.info(
                        "      EMA price ({}):", listener.session_mark_px_ema_field
                    )
                    logger.info("        {}", parsed.get("ema_price"))

                self.results.append(
                    ValidationResult(
                        success=True,
                        message=f"SEDA feed {feed_name} poll successful",
                        details={
                            "feed_name": feed_name,
                            **parsed,
                        },
                    )
                )
            else:
                self.results.append(
                    ValidationResult(
                        success=False,
                        message=f"SEDA feed {feed_name} poll succeeded but no data parsed",
                    )
                )
                logger.error("    ✗ Poll succeeded but no data parsed")
        else:
            error_msg = result.get("error", "Unknown error")
            status = result.get("status")
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"SEDA feed {feed_name} poll failed: {status or error_msg}",
                    details={"status": status, "error": error_msg},
                )
            )
            logger.error(
                "    ✗ Poll failed: {}", error_msg[:200] if error_msg else "Unknown"
            )

    # =========================================================================
    # Lazer Testing (WebSocket)
    # =========================================================================

    async def _test_lazer_endpoint(self) -> None:
        """Test Lazer WebSocket by connecting and receiving prices.

        Uses the actual LazerListener class methods:
        - get_auth_headers(): builds auth headers
        - send_subscribe(): sends the subscribe message
        - receive_and_parse_message(): receives and parses a single message
        """
        assert self.config is not None

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 4: Testing Lazer WebSocket")
        logger.info("=" * 60)

        lazer_config = self.config.lazer
        if not lazer_config.feed_ids:
            logger.info("No Lazer feeds configured, skipping")
            return

        if not lazer_config.lazer_urls:
            logger.error("✗ No Lazer URLs configured")
            self.results.append(
                ValidationResult(success=False, message="No Lazer URLs configured")
            )
            return

        lazer_state = PriceSourceState("lazer_validation")

        listener = LazerListener(self.config, lazer_state)

        url = lazer_config.lazer_urls[0]
        logger.info("URL: {}", url)
        logger.info("Feed IDs: {}", listener.feed_ids)
        logger.info("Connecting...")

        try:
            headers = listener.get_auth_headers()
            async with websockets.connect(url, additional_headers=headers) as ws:
                await listener.send_subscribe(ws, url)
                logger.info("  Sent subscribe request")

                # Collect prices until we have all feeds or timeout
                expected_feeds = set(listener.feed_ids)
                start_time = asyncio.get_event_loop().time()

                while len(lazer_state.state) < len(expected_feeds):
                    elapsed = asyncio.get_event_loop().time() - start_time
                    remaining = WS_RECEIVE_TIMEOUT_SECONDS - elapsed
                    if remaining <= 0:
                        break

                    try:
                        # Use listener's receive_and_parse_message method
                        await listener.receive_and_parse_message(ws, remaining)
                    except StaleConnectionError:
                        # Timeout is expected in validation mode
                        break
                    except Exception as e:
                        logger.warning("  Error receiving message: {}", repr(e))
                        break

                # Report results from the populated state
                if lazer_state.state:
                    logger.success("  ✓ Connection successful")
                    logger.info("  Received {} price(s):", len(lazer_state.state))
                    for feed_id, update in sorted(lazer_state.state.items()):
                        # Scale price by exponent to get USD value
                        scaled_price = float(update.price) * (10**PYTH_DEFAULT_EXPONENT)
                        logger.info("    Feed {}: ${:,.2f}", feed_id, scaled_price)

                    self.results.append(
                        ValidationResult(
                            success=True,
                            message=f"Lazer WebSocket received {len(lazer_state.state)} prices",
                            details={
                                "prices": {
                                    k: {"price": v.price, "timestamp": v.timestamp}
                                    for k, v in lazer_state.state.items()
                                }
                            },
                        )
                    )

                    # Check for missing feeds
                    missing = expected_feeds - set(lazer_state.state.keys())
                    if missing:
                        logger.warning("  Missing feeds: {}", list(missing))
                else:
                    logger.error("  ✗ No prices received within timeout")
                    self.results.append(
                        ValidationResult(
                            success=False,
                            message="Lazer WebSocket connected but no prices received",
                        )
                    )

        except websockets.exceptions.InvalidStatusCode as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Lazer WebSocket connection rejected: {e.status_code}",
                )
            )
            logger.error("  ✗ Connection rejected with status {}", e.status_code)

        except Exception as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Lazer WebSocket error: {e}",
                )
            )
            logger.error("  ✗ Connection error: {}", repr(e))

    # =========================================================================
    # Hermes Testing (WebSocket)
    # =========================================================================

    async def _test_hermes_endpoint(self) -> None:
        """Test Hermes WebSocket by connecting and receiving prices.

        Uses the actual HermesListener class methods:
        - send_subscribe(): sends the subscribe message
        - receive_and_parse_message(): receives and parses a single message
        """
        assert self.config is not None

        logger.info("")
        logger.info("=" * 60)
        logger.info("STEP 5: Testing Hermes WebSocket")
        logger.info("=" * 60)

        hermes_config = self.config.hermes
        if not hermes_config.feed_ids:
            logger.info("No Hermes feeds configured, skipping")
            return

        if not hermes_config.hermes_urls:
            logger.error("✗ No Hermes URLs configured")
            self.results.append(
                ValidationResult(success=False, message="No Hermes URLs configured")
            )
            return

        hermes_state = PriceSourceState("hermes_validation")

        listener = HermesListener(self.config, hermes_state)

        url = hermes_config.hermes_urls[0]
        logger.info("URL: {}", url)
        logger.info("Feed IDs: {}", [fid[:16] + "..." for fid in listener.feed_ids])
        logger.info("Connecting...")

        try:
            async with websockets.connect(url) as ws:
                # Use listener's send_subscribe method
                await listener.send_subscribe(ws, url)
                logger.info("  Sent subscribe request")

                # Collect prices until we have all feeds or timeout
                expected_feeds = set(listener.feed_ids)
                start_time = asyncio.get_event_loop().time()

                while len(hermes_state.state) < len(expected_feeds):
                    elapsed = asyncio.get_event_loop().time() - start_time
                    remaining = WS_RECEIVE_TIMEOUT_SECONDS - elapsed
                    if remaining <= 0:
                        break

                    try:
                        # Use listener's receive_and_parse_message method
                        await listener.receive_and_parse_message(ws, remaining)
                    except StaleConnectionError:
                        # Timeout is expected in validation mode
                        break
                    except Exception as e:
                        logger.warning("  Error receiving message: {}", repr(e))
                        break

                # Report results from the populated state
                if hermes_state.state:
                    logger.success("  ✓ Connection successful")
                    logger.info("  Received {} price(s):", len(hermes_state.state))
                    for feed_id, update in hermes_state.state.items():
                        # Scale price by exponent to get USD value
                        scaled_price = float(update.price) * (10**PYTH_DEFAULT_EXPONENT)
                        logger.info(
                            "    Feed {}...: ${:,.2f}", str(feed_id)[:16], scaled_price
                        )

                    self.results.append(
                        ValidationResult(
                            success=True,
                            message=f"Hermes WebSocket received {len(hermes_state.state)} prices",
                            details={
                                "prices": {
                                    k: {"price": v.price, "timestamp": v.timestamp}
                                    for k, v in hermes_state.state.items()
                                }
                            },
                        )
                    )

                    # Check for missing feeds
                    missing = expected_feeds - set(hermes_state.state.keys())
                    if missing:
                        logger.warning(
                            "  Missing feeds: {}",
                            [str(fid)[:16] + "..." for fid in missing],
                        )
                else:
                    logger.error("  ✗ No prices received within timeout")
                    self.results.append(
                        ValidationResult(
                            success=False,
                            message="Hermes WebSocket connected but no prices received",
                        )
                    )

        except websockets.exceptions.InvalidStatusCode as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Hermes WebSocket connection rejected: {e.status_code}",
                )
            )
            logger.error("  ✗ Connection rejected with status {}", e.status_code)

        except Exception as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Hermes WebSocket error: {e}",
                )
            )
            logger.error("  ✗ Connection error: {}", repr(e))

    def _print_summary(self) -> bool:
        """Print validation summary and return True if all passed."""
        logger.info("")
        logger.info("=" * 60)
        logger.info("SUMMARY")
        logger.info("=" * 60)

        successes = [r for r in self.results if r.success]
        failures = [r for r in self.results if not r.success]

        logger.info("Total checks: {}", len(self.results))
        logger.info("  ✓ Passed: {}", len(successes))
        logger.info("  ✗ Failed: {}", len(failures))

        if failures:
            logger.info("")
            logger.error("Failed checks:")
            for result in failures:
                logger.error("  - {}", result.message)
            return False

        logger.success("")
        logger.success("All validations passed! ✓")
        logger.info("")
        logger.warning(
            "REMINDER: Spot check the prices above to ensure they are reasonable."
        )
        return True


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Validate HIP-3 pusher configuration and test data sources"
    )
    parser.add_argument(
        "-c",
        "--config",
        required=True,
        help="Path to the config file (TOML format)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose/debug logging",
    )
    args = parser.parse_args()

    # Get SEDA API key from environment
    seda_api_key = os.environ.get("SEDA_API_KEY")

    # Configure logging
    logger.remove()
    log_level = "DEBUG" if args.verbose else "INFO"
    logger.add(
        sys.stderr,
        level=log_level,
        format="<level>{level: <8}</level> | {message}",
    )

    logger.info("HIP-3 Pusher Configuration Validator")
    logger.info("Config file: {}", args.config)
    logger.info("")

    validator = ConfigValidator(args.config, seda_api_key)
    success = validator.validate_all()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
