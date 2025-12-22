import argparse
from pathlib import Path

from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
from hyperliquid.utils.signing import get_timestamp_ms, sign_l1_action


def main():
    parser = argparse.ArgumentParser(
        description="Permission/depermission subdeployer account for setOracle for HIP-3 dex"
    )
    parser.add_argument(
        "--private-key-file",
        required=True,
        help="Path to private key file for deployer account",
    )
    parser.add_argument(
        "--dex",
        required=True,
        help="HIP-3 dex name (should be short string)"
    )
    parser.add_argument(
        "--subdeployer-address",
        required=True,
        help="Subdeployer address",
    )
    enable_disable = parser.add_mutually_exclusive_group(required=True)
    enable_disable.add_argument(
        "--enable",
        action="store_true",
        help="Enable subdeployer for setOracle",
    )
    enable_disable.add_argument(
        "--disable",
        action="store_true",
        help="Disable subdeployer for setOracle",
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

    deployer_account = Account.from_key(Path(args.private_key_file).read_text().strip())
    deployer_exchange = Exchange(wallet=deployer_account, base_url=base_url)
    print("deployer address:", deployer_account.address)
    subdeployer_address = args.subdeployer_address
    print("dex:", args.dex)
    print("subdeployer address:", subdeployer_address)
    mode = "enable" if args.enable else "disable"
    print("mode:", mode)

    if args.dry_run:
        print(f"dry run: {network}: would {mode} setOracle for {subdeployer_address} in dex {args.dex}")
    else:
        timestamp = get_timestamp_ms()
        sub_deployer = {
            "variant": "setOracle",
            "user": subdeployer_address.lower(),
            "allowed": True if args.enable else False,
        }
        action = {
            "type": "perpDeploy",
            "setSubDeployers": {
                "dex": args.dex,
                "subDeployers": [sub_deployer]
            }
        }
        signature = sign_l1_action(
            deployer_exchange.wallet,
            action,
            deployer_exchange.vault_address,
            timestamp,
            deployer_exchange.expires_after,
            deployer_exchange.base_url == constants.MAINNET_API_URL,
        )
        print("calling perpDeploy.setSubdeployers...")
        print(deployer_exchange._post_action(action, signature, timestamp))


if __name__ == "__main__":
    main()
