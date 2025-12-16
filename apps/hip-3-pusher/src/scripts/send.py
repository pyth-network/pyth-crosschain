import argparse
from pathlib import Path

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants


def main():
    parser = argparse.ArgumentParser(
        description="Send USDC from one Hyperliquid account to another (at least 6 to activate new one)"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file for account",
    )
    parser.add_argument(
        "--recipient-address",
        required=True,
        help="Recipient address",
    )
    parser.add_argument(
        "--amount",
        type=float,
        required=True,
        help="Amount to send in USDC",
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

    network = "testnet" if args.testnet else "mainnet"
    base_url = constants.TESTNET_API_URL if args.testnet else constants.MAINNET_API_URL
    print(f"Using {network} URL: {base_url}")

    sender_account = Account.from_key(Path(args.private_key_file).read_text().strip())
    sender_exchange = Exchange(wallet=sender_account, base_url=base_url)
    print("sender address:", sender_account.address)
    recipient_address = args.recipient_address
    print("recipient address:", recipient_address)
    amount = args.amount
    print("amount:", amount)

    if args.dry_run:
        print(f"dry run: {network}: would send {amount} USDC from {sender_account.address} to {recipient_address}")
    else:
        print("calling usd_transfer...")
        print(sender_exchange.usd_transfer(amount=amount, destination=recipient_address))


if __name__ == "__main__":
    main()
