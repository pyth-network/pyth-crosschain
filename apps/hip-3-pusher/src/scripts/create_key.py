import argparse

from eth_account import Account


def main():
    parser = argparse.ArgumentParser(
        description="Create new key"
    )
    output = parser.add_mutually_exclusive_group(required=True)
    output.add_argument(
        "--output-file",
        metavar="PATH",
        help="Write the private key (in hex) to a file",
    )
    output.add_argument(
        "--stdout",
        action="store_true",
        help="Print the private key to stdout",
    )

    args = parser.parse_args()
    account = Account.create()
    print("address:", account.address)
    private_key_hex = account.key.hex()
    if args.stdout:
        print("private key:", private_key_hex)
    else:
        open(args.output_file, "w").write(private_key_hex)
        print("wrote private key to file:", args.output_file)


if __name__ == "__main__":
    main()
