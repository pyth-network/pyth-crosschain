import argparse
import asyncio
from loguru import logger
import toml

from hyperliquid_listener import HyperliquidListener
from lazer_listener import LazerListener
from hermes_listener import HermesListener
from price_state import PriceState
from publisher import Publisher


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


async def main():
    logger.info("Starting hip3-agent...")
    config = load_config()

    price_state = PriceState()
    publisher = Publisher(config, price_state)
    hyperliquid_listener = HyperliquidListener(config, price_state)
    lazer_listener = LazerListener(config, price_state)
    hermes_listener = HermesListener(config, price_state)

    # TODO: Probably pull this out of the sdk.
    hyperliquid_listener.subscribe()
    await asyncio.gather(
        publisher.run(),
        lazer_listener.subscribe_all(),
        hermes_listener.subscribe_all(),
    )
    logger.info("Exiting hip3-agent...")


if __name__ == "__main__":
    asyncio.run(main())
