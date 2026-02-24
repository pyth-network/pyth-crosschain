import argparse
from pathlib import Path

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set user abstraction type"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file for account",
    )
    parser.add_argument(
        "--abstraction",
        required=True,
        help="User abstraction type: disabled, unifiedAccount, portfolioMargin (you probably want disabled)",
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
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show parameters without sending",
    )

    args = parser.parse_args()

    network_name = "testnet" if args.testnet else "mainnet"
    base_url = constants.TESTNET_API_URL if args.testnet else constants.MAINNET_API_URL
    print(f"Using {network_name} URL: {base_url}")

    account = Account.from_key(Path(args.private_key_file).read_text().strip())
    exchange = Exchange(wallet=account, base_url=base_url)
    print("address:", account.address)
    print("abstraction", args.abstraction)

    if args.dry_run:
        print(
            f"dry run: {network_name}: would set {account.address} to user abstraction {args.abstraction}"
        )
    else:
        print("calling userSetAbstraction...")
        print(exchange.user_set_abstraction(account.address, args.abstraction))


if __name__ == "__main__":
    main()
