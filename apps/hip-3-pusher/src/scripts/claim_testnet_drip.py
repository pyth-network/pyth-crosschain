import argparse
from pathlib import Path

import httpx
from eth_account import Account
from hyperliquid.utils import constants


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Claim testnet USDC drip (1000 USDC, once per address)"
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--private-key-file",
        help="Path to private key file (address will be derived)",
    )
    source.add_argument(
        "--address",
        help="Wallet address to claim drip for",
    )

    args = parser.parse_args()

    if args.private_key_file:
        account = Account.from_key(Path(args.private_key_file).read_text().strip())
        address = account.address
    else:
        address = args.address

    print(f"Claiming testnet drip for: {address}")
    print(f"Using testnet URL: {constants.TESTNET_API_URL}")

    response = httpx.post(
        f"{constants.TESTNET_API_URL}/info",
        json={"type": "claimDrip", "user": address},
    )
    response.raise_for_status()
    print(f"Response: {response.text}")


if __name__ == "__main__":
    main()
