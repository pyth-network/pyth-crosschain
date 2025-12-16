import argparse
from pathlib import Path

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from hyperliquid.utils.constants import MAINNET_API_URL
from hyperliquid.utils.signing import get_timestamp_ms, sign_l1_action


def reserve_request_weight(exchange: Exchange, weight: int):
    timestamp = get_timestamp_ms()
    reserve_action = {
        "type": "reserveRequestWeight",
        "weight": weight,
    }
    signature = sign_l1_action(
        exchange.wallet,
        reserve_action,
        exchange.vault_address,
        timestamp,
        exchange.expires_after,
        exchange.base_url == MAINNET_API_URL,
    )
    return exchange._post_action(
        reserve_action,
        signature,
        timestamp,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Reserve requests for a single account (0.0005 USDC per transaction)"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file for account",
    )
    parser.add_argument(
        "--weight",
        type=int,
        required=True,
        help="request weight to reserve",
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

    account = Account.from_key(Path(args.private_key_file).read_text().strip())
    exchange = Exchange(wallet=account, base_url=base_url)
    print("address:", account.address)
    weight = args.weight
    print("weight:", weight)

    if args.dry_run:
        print(f"dry run: {network}: would reserve {weight} request weight for account {account.address}")
    else:
        print("calling reserveRequestWeight...")
        print(reserve_request_weight(exchange, weight))


if __name__ == "__main__":
    main()
