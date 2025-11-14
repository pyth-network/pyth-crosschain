import argparse
import asyncio
from loguru import logger
import os
import sys
import tomllib

from pusher.config import Config
from pusher.hyperliquid_listener import HyperliquidListener
from pusher.lazer_listener import LazerListener
from pusher.hermes_listener import HermesListener
from pusher.seda_listener import SedaListener
from pusher.price_state import PriceState
from pusher.publisher import Publisher
from pusher.metrics import Metrics


def load_config():
    parser = argparse.ArgumentParser(description="hip3-agent command-line arguments")
    parser.add_argument(
        "-c", "--config",
        required=True,
        help="hip3-agent config file",
    )
    config_path = parser.parse_args().config
    with open(config_path, "rb") as config_file:
        config_toml = tomllib.load(config_file)
        config = Config(**config_toml)
        logger.debug("Config loaded: {}", config)
    return config


def init_logging():
    logger.remove()
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    # serialize=True if we want json logging
    logger.add(sys.stderr, level=log_level, serialize=False)


async def main():
    init_logging()
    logger.info("Starting hip-3-pusher...")
    config = load_config()

    price_state = PriceState(config)
    metrics = Metrics(config)

    publisher = Publisher(config, price_state, metrics)
    hyperliquid_listener = HyperliquidListener(config, price_state.hl_oracle_state, price_state.hl_mark_state, price_state.hl_mid_state)
    lazer_listener = LazerListener(config, price_state.lazer_state)
    hermes_listener = HermesListener(config, price_state.hermes_state)
    seda_listener = SedaListener(config, price_state.seda_state)

    await asyncio.gather(
        publisher.run(),
        hyperliquid_listener.subscribe_all(),
        lazer_listener.subscribe_all(),
        hermes_listener.subscribe_all(),
        seda_listener.run(),
    )
    logger.info("Exiting hip-3-pusher..")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.exception("Uncaught exception, exiting; error: {}", repr(e))
