import argparse
import asyncio
from loguru import logger
import os
import sys
import toml

from hyperliquid_listener import HyperliquidListener
from lazer_listener import LazerListener
from hermes_listener import HermesListener
from price_state import PriceState
from publisher import Publisher
from metrics import Metrics


def load_config():
    parser = argparse.ArgumentParser(description="hip3-agent command-line arguments")
    parser.add_argument(
        "-c", "--config",
        required=True,
        help="hip3-agent config file",
    )
    config_path = parser.parse_args().config
    with open(config_path, "r") as config_file:
        config = toml.load(config_file)
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
    hyperliquid_listener = HyperliquidListener(config, price_state)
    lazer_listener = LazerListener(config, price_state)
    hermes_listener = HermesListener(config, price_state)

    # TODO: Probably pull this out of the sdk so we can handle reconnects.
    hyperliquid_listener.subscribe()
    await asyncio.gather(
        publisher.run(),
        lazer_listener.subscribe_all(),
        hermes_listener.subscribe_all(),
    )
    logger.info("Exiting hip-3-pusher..")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.exception("Uncaught exception, exiting: {}", e)
