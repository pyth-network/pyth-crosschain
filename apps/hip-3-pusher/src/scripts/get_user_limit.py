import argparse

from hyperliquid.info import Info
from hyperliquid.utils import constants


def main():
    parser = argparse.ArgumentParser(
        description="Check user rate limit"
    )
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

    network = "testnet" if args.testnet else "mainnet"
    base_url = constants.TESTNET_API_URL if args.testnet else constants.MAINNET_API_URL
    print(f"Using {network} URL: {base_url}")
    print("address:", args.address)

    info = Info(base_url=base_url, skip_ws=True)
    print("calling userRateLimit...")
    print(info.user_rate_limit(args.address))


if __name__ == "__main__":
    main()
