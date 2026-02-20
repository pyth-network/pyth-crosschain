import argparse
from pathlib import Path

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transfer USDC between spot and perps balances"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file for account",
    )
    parser.add_argument(
        "--amount",
        type=float,
        required=True,
        help="Amount to transfer in USDC",
    )
    parser.add_argument(
        "--to-perp",
        type=bool,
        required=True,
        help="Transfer from spot to perp balance or vice versa (you probably want true)",
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
    print("amount:", args.amount)
    print("to_perp:", args.to_perp)

    if args.dry_run:
        print(
            f"dry run: {network_name}: would transfer {args.amount} USDC in {account.address} with to_perp={args.to_perp}"
        )
    else:
        print("calling usdClassTransfer...")
        print(exchange.usd_class_transfer(amount=args.amount, to_perp=args.to_perp))


if __name__ == "__main__":
    main()
