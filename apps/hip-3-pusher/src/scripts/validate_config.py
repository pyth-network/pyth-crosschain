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

Output is GitHub Markdown friendly for posting as PR comments.
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


def md_print(msg: str = "") -> None:
    """Print markdown-formatted output to stdout."""
    print(msg)


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
        md_print("## 1. Config Structure Validation")
        md_print()

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
            md_print("✅ Config structure is valid")
            md_print()
            return True

        except FileNotFoundError:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Config file not found: {self.config_path}",
                )
            )
            md_print(f"❌ Config file not found: `{self.config_path}`")
            md_print()
            return False

        except tomllib.TOMLDecodeError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Invalid TOML syntax: {e}",
                )
            )
            md_print(f"❌ Invalid TOML syntax: `{e}`")
            md_print()
            return False

        except ValidationError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Config validation failed: {e}",
                    details={"errors": e.errors()},
                )
            )
            md_print("❌ Config validation failed:")
            md_print()
            for error in e.errors():
                loc = ".".join(str(x) for x in error["loc"])
                md_print(f"- `{loc}`: {error['msg']}")
            md_print()
            return False

    def _report_configured_sources(self) -> None:
        """Report what price sources are configured."""
        assert self.config is not None

        md_print("## 2. Configured Price Sources")
        md_print()

        price_config = self.config.price

        # Oracle prices
        if price_config.oracle:
            md_print("### Oracle Prices")
            md_print()
            md_print("| Symbol | Sources |")
            md_print("|--------|---------|")
            for symbol, sources in price_config.oracle.items():
                source_names = [self._describe_source(s) for s in sources]
                md_print(f"| `{symbol}` | {', '.join(source_names)} |")
            md_print()

        # Mark prices
        if price_config.mark:
            md_print("### Mark Prices")
            md_print()
            md_print("| Symbol | Sources |")
            md_print("|--------|---------|")
            for symbol, sources in price_config.mark.items():
                source_names = [self._describe_source(s) for s in sources]
                md_print(f"| `{symbol}` | {', '.join(source_names)} |")
            md_print()

        # External prices
        if price_config.external:
            md_print("### External Prices")
            md_print()
            md_print("| Symbol | Sources |")
            md_print("|--------|---------|")
            for symbol, sources in price_config.external.items():
                source_names = [self._describe_source(s) for s in sources]
                md_print(f"| `{symbol}` | {', '.join(source_names)} |")
            md_print()

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

        md_print("## 3. SEDA Endpoint Tests")
        md_print()

        seda_config = self.config.seda
        if not seda_config.feeds:
            md_print("_No SEDA feeds configured, skipping_")
            md_print()
            return

        # Check for API key
        if not self.seda_api_key and not seda_config.api_key_path:
            self.results.append(
                ValidationResult(
                    success=False,
                    message="SEDA API key not provided (set SEDA_API_KEY env var or configure api_key_path)",
                )
            )
            md_print(
                "❌ SEDA API key not provided. Set `SEDA_API_KEY` environment variable or configure `api_key_path`"
            )
            md_print()
            return

        seda_state = PriceSourceState("seda_validation")
        seda_last_state = PriceSourceState("seda_last_validation")
        seda_ema_state = PriceSourceState("seda_ema_validation")
        seda_oracle_state = PriceSourceState("seda_oracle_validation")
        seda_mark_state = PriceSourceState("seda_mark_validation")
        seda_external_state = PriceSourceState("seda_external_validation")

        listener = SedaListener(
            self.config,
            seda_state,
            seda_last_state,
            seda_ema_state,
            seda_oracle_state,
            seda_mark_state,
            seda_external_state,
            api_key_override=self.seda_api_key,
        )

        if not listener.api_key:
            self.results.append(
                ValidationResult(
                    success=False,
                    message="SEDA API key not provided or could not be read",
                )
            )
            md_print("❌ SEDA API key not available")
            md_print()
            return

        md_print(f"**URL:** `{listener.url}`")
        md_print()
        md_print(f"Testing {len(seda_config.feeds)} feed(s)...")
        md_print()

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

        md_print(f"### Feed: `{feed_name}`")
        md_print()
        md_print(f"- **Program ID:** `{feed_config_typed.exec_program_id}`")

        # Validate exec_inputs JSON before polling
        try:
            json.loads(feed_config_typed.exec_inputs)
            md_print("- **Exec inputs:** Valid JSON ✅")
        except json.JSONDecodeError as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"SEDA feed {feed_name} has invalid exec_inputs JSON: {e}",
                )
            )
            md_print(f"- **Exec inputs:** Invalid JSON ❌ - `{e}`")
            md_print()
            return

        # Use listener's poll_single_feed method
        result = await listener.poll_single_feed(client, feed_name, feed_config_typed)

        if result["ok"]:
            # Get parsed result from state
            parsed = listener.get_parsed_result(feed_name)
            if parsed:
                md_print("- **Status:** Poll successful ✅")
                md_print()
                md_print("| Field | Value |")
                md_print("|-------|-------|")
                md_print(f"| Price (`{listener.price_field}`) | `{parsed['price']}` |")
                md_print(
                    f"| Timestamp (`{listener.timestamp_field}`) | `{parsed['timestamp']}` |"
                )

                if listener.session_flag_field:
                    md_print(
                        f"| Session Flag (`{listener.session_flag_field}`) | `{parsed['session_flag']}` |"
                    )

                if listener.last_price_field:
                    md_print(
                        f"| Last Price (`{listener.last_price_field}`) | `{parsed.get('last_price')}` |"
                    )

                if listener.session_mark_px_ema_field:
                    md_print(
                        f"| EMA Price (`{listener.session_mark_px_ema_field}`) | `{parsed.get('ema_price')}` |"
                    )

                md_print()

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
                md_print("- **Status:** Poll succeeded but no data parsed ❌")
                md_print()
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
            md_print(
                f"- **Status:** Poll failed ❌ - `{error_msg[:200] if error_msg else 'Unknown'}`"
            )
            md_print()

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

        md_print("## 4. Lazer WebSocket Test")
        md_print()

        lazer_config = self.config.lazer
        if not lazer_config.feed_ids:
            md_print("_No Lazer feeds configured, skipping_")
            md_print()
            return

        if not lazer_config.lazer_urls:
            md_print("❌ No Lazer URLs configured")
            md_print()
            self.results.append(
                ValidationResult(success=False, message="No Lazer URLs configured")
            )
            return

        lazer_state = PriceSourceState("lazer_validation")

        listener = LazerListener(self.config, lazer_state)

        url = lazer_config.lazer_urls[0]
        md_print(f"**URL:** `{url}`")
        md_print()
        md_print(f"**Feed IDs:** `{listener.feed_ids}`")
        md_print()

        try:
            headers = listener.get_auth_headers()
            async with websockets.connect(url, additional_headers=headers) as ws:
                await listener.send_subscribe(ws, url)

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
                    except Exception:
                        break

                # Report results from the populated state
                if lazer_state.state:
                    md_print("| Feed ID | Price (USD) |")
                    md_print("|---------|-------------|")
                    for feed_id, update in sorted(lazer_state.state.items()):
                        # Scale price by exponent to get USD value
                        scaled_price = float(update.price) * (10**PYTH_DEFAULT_EXPONENT)
                        md_print(f"| {feed_id} | ${scaled_price:,.2f} |")
                    md_print()

                    # Check for missing feeds - this is a failure condition
                    missing = expected_feeds - set(lazer_state.state.keys())
                    if missing:
                        md_print(f"❌ Missing feeds: `{sorted(missing)}`")
                        md_print()
                        self.results.append(
                            ValidationResult(
                                success=False,
                                message=f"Lazer WebSocket missing {len(missing)} feed(s): {sorted(missing)}",
                                details={
                                    "received": list(lazer_state.state.keys()),
                                    "missing": sorted(missing),
                                },
                            )
                        )
                    else:
                        md_print("✅ All configured feeds received")
                        md_print()
                        self.results.append(
                            ValidationResult(
                                success=True,
                                message=f"Lazer WebSocket received all {len(lazer_state.state)} configured prices",
                                details={
                                    "prices": {
                                        k: {"price": v.price, "timestamp": v.timestamp}
                                        for k, v in lazer_state.state.items()
                                    }
                                },
                            )
                        )
                else:
                    md_print("❌ No prices received within timeout")
                    md_print()
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
            md_print(f"❌ Connection rejected with status `{e.status_code}`")
            md_print()

        except Exception as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Lazer WebSocket error: {e}",
                )
            )
            md_print(f"❌ Connection error: `{e!r}`")
            md_print()

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

        md_print("## 5. Hermes WebSocket Test")
        md_print()

        hermes_config = self.config.hermes
        if not hermes_config.feed_ids:
            md_print("_No Hermes feeds configured, skipping_")
            md_print()
            return

        if not hermes_config.hermes_urls:
            md_print("❌ No Hermes URLs configured")
            md_print()
            self.results.append(
                ValidationResult(success=False, message="No Hermes URLs configured")
            )
            return

        hermes_state = PriceSourceState("hermes_validation")

        listener = HermesListener(self.config, hermes_state)

        url = hermes_config.hermes_urls[0]
        md_print(f"**URL:** `{url}`")
        md_print()
        md_print(f"**Feed IDs:** `{[fid[:16] + '...' for fid in listener.feed_ids]}`")
        md_print()

        try:
            async with websockets.connect(url) as ws:
                # Use listener's send_subscribe method
                await listener.send_subscribe(ws, url)

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
                    except Exception:
                        break

                # Report results from the populated state
                if hermes_state.state:
                    md_print("| Feed ID | Price (USD) |")
                    md_print("|---------|-------------|")
                    for feed_id, update in hermes_state.state.items():
                        # Scale price by exponent to get USD value
                        scaled_price = float(update.price) * (10**PYTH_DEFAULT_EXPONENT)
                        md_print(f"| `{str(feed_id)[:16]}...` | ${scaled_price:,.2f} |")
                    md_print()

                    # Check for missing feeds - this is a failure condition
                    missing = expected_feeds - set(hermes_state.state.keys())
                    if missing:
                        missing_truncated = [
                            f"{fid[:16]}..." for fid in sorted(missing)
                        ]
                        md_print(f"❌ Missing feeds: `{missing_truncated}`")
                        md_print()
                        self.results.append(
                            ValidationResult(
                                success=False,
                                message=f"Hermes WebSocket missing {len(missing)} feed(s): {missing_truncated}",
                                details={
                                    "received": list(hermes_state.state.keys()),
                                    "missing": sorted(missing),
                                },
                            )
                        )
                    else:
                        md_print("✅ All configured feeds received")
                        md_print()
                        self.results.append(
                            ValidationResult(
                                success=True,
                                message=f"Hermes WebSocket received all {len(hermes_state.state)} configured prices",
                                details={
                                    "prices": {
                                        k: {"price": v.price, "timestamp": v.timestamp}
                                        for k, v in hermes_state.state.items()
                                    }
                                },
                            )
                        )
                else:
                    md_print("❌ No prices received within timeout")
                    md_print()
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
            md_print(f"❌ Connection rejected with status `{e.status_code}`")
            md_print()

        except Exception as e:
            self.results.append(
                ValidationResult(
                    success=False,
                    message=f"Hermes WebSocket error: {e}",
                )
            )
            md_print(f"❌ Connection error: `{e!r}`")
            md_print()

    def _print_summary(self) -> bool:
        """Print validation summary and return True if all passed."""
        md_print("---")
        md_print()
        md_print("## Summary")
        md_print()

        successes = [r for r in self.results if r.success]
        failures = [r for r in self.results if not r.success]

        md_print(f"**Total checks:** {len(self.results)}")
        md_print(f"- ✅ Passed: {len(successes)}")
        md_print(f"- ❌ Failed: {len(failures)}")
        md_print()

        if failures:
            md_print("### Failed Checks")
            md_print()
            for result in failures:
                md_print(f"- ❌ {result.message}")
            md_print()
            return False

        md_print("### ✅ All validations passed!")
        md_print()
        md_print(
            "> **⚠️ REMINDER:** Spot check the prices above to ensure they are reasonable."
        )
        md_print()
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

    # Disable loguru output - we output markdown to stdout
    logger.remove()
    if args.verbose:
        logger.add(sys.stderr, level="DEBUG", format="{message}")

    # Print markdown header
    md_print("# HIP-3 Pusher Configuration Validation")
    md_print()
    md_print(f"**Config file:** `{args.config}`")
    md_print()

    validator = ConfigValidator(args.config, seda_api_key)
    success = validator.validate_all()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
