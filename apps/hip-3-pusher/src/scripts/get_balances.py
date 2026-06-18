import argparse

from hyperliquid.info import Info
from hyperliquid.utils import constants
from hyperliquid.utils.types import Meta, SpotMeta


def main() -> None:
    parser = argparse.ArgumentParser(description="Check user balances")
    parser.add_argument(
        "--address",
        required=True,
        help="Address",
    )
    network = parser.add_mutually_exclusive_group(required=True)
    network.add_argument(
        "--testnet",
        action="store_true",
        help="Use testnet",
    )
    network.add_argument(
        "--mainnet",
        action="store_true",
        help="Use mainnet",
    )

    args = parser.parse_args()

    network_name = "testnet" if args.testnet else "mainnet"
    base_url = constants.TESTNET_API_URL if args.testnet else constants.MAINNET_API_URL
    print(f"Using {network_name} URL: {base_url}")
    print("address:", args.address)

    info = Info(
        base_url=base_url,
        skip_ws=True,
        meta=Meta(universe=[]),
        spot_meta=SpotMeta(universe=[], tokens=[]),
    )
    print("calling clearinghouseState...")
    print(info.user_state(args.address))
    print("calling spotClearinghouseState...")
    print(info.spot_user_state(args.address))


if __name__ == "__main__":
    main()
