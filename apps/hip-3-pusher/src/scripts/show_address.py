import argparse

from eth_account import Account
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Print address of given private key"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file",
    )

    args = parser.parse_args()
    account = Account.from_key(Path(args.private_key_file).read_text().strip())
    print("address:", account.address)


if __name__ == "__main__":
    main()
