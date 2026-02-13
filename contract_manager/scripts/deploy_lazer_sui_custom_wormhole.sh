#!/usr/bin/env bash

# Deploys testnet Sui Lazer contract with custom version of Wormhole, e.g. to
# use mainnet guardians on testnet. Requires path to clone of Wormhole
# repository and Sui key to use for signing transactions.

PYTH_DIR=$(git rev-parse --show-toplevel)
WH_DIR=""
KEY_ALIAS=""

while [[ $# -gt 0 ]]; do
    case $1 in
    --wh-dir)
        if [[ -z "$2" ]]; then
            echo "Error: --wh-dir requires a value"
            exit 1
        fi
        WH_DIR=$(realpath "$2")
        shift 2
        ;;
    --key-alias)
        if [[ -z "$2" ]]; then
            echo "Error: --key-alias requires a value"
            exit 1
        fi
        KEY_ALIAS="$2"
        shift 2
        ;;
    *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

if [[ -z "$WH_DIR" ]]; then
    echo "Error: --wh-dir is required"
    exit 1
fi

if [[ -z "$KEY_ALIAS" ]]; then
    echo "Error: --key-alias is required"
    exit 1
fi

# Get current guardian set:
# curl "https://api.wormholescan.io/api/v1/governor/config" | jq -r '[.data[].id] | join(",")'

# Mainnet set
GUARDIAN_SET_INDEX=4
GUARDIAN_SET="5893B5A76c3f739645648885bDCcC06cd70a3Cd3,fF6CB952589BDE862c25Ef4392132fb9D4A42157,114De8460193bdf3A2fCf81f86a09765F4762fD1,107A0086b32d7A0977926A205131d8731D39cbEB,8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2,11b39756C042441BE6D8650b69b54EbE715E2343,54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd,15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20,74a3bf913953D695260D88BC1aA25A4eeE363ef0,000aC0076727b35FBea2dAc28fEE5cCB0fEA768e,AF45Ced136b9D9e24903464AE889F5C8a723FC14,f93124b7c738843CBB89E864c862c38cddCccF95,D2CC37A4dc036a8D232b48f62cDD4731412f4890,DA798F6896A3331F64b48c12D1D57Fd9cbe70811,71AA1BE1D36CaFE3867910F99C09e347899C19C3,8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf,178e21ad2E77AE06711549CFBB1f9c7a9d8096e8,5E1487F35515d02A92753504a8D75471b9f49EdB,6FbEBc898F403E4773E95feB15E80C9A99c8348d"

# Testnet set
# GUARDIAN_SET_INDEX=1
# GUARDIAN_SET="13947bd48b18e53fdaeee77f3473391ac727c638"

object-url() {
    echo "https://explorer.polymedia.app/object/$2?network=$1"
}

tx-url() {
    echo "https://explorer.polymedia.app/txblock/$2?network=$1"
}

CM_DIR="$PYTH_DIR/contract_manager"
WH_PKG_DIR="$WH_DIR/sui/wormhole"

CHAIN="sui_testnet"
# CHAIN="sui_localnet"
ENV_ALIAS="testnet"
# ENV_ALIAS="localnet"
ENV_RPC="https://fullnode.testnet.sui.io:443"
# ENV_RPC="http://127.0.0.1:9000"

SUI_KEY=$(
    sui keytool export --key-identity "$KEY_ALIAS" --json |
        jq -r '.exportedPrivateKey'
)

WORM_KEY=$(
    sui keytool convert "$SUI_KEY" --json |
        jq -r '.base64WithFlag'
)

set -xeuo pipefail

if [[ "$ENV_ALIAS" = "localnet" ]]; then
    sui client new-env --alias "$ENV_ALIAS" --rpc "$ENV_RPC" || true
fi
sui client switch --address "$KEY_ALIAS" --env "$ENV_ALIAS"
if [[ "$ENV_ALIAS" = "localnet" ]]; then
    sui client faucet
fi
sui client balance

CHAIN_ID=$(sui client chain-identifier)

cd "$WH_DIR/clients/js"
make install

if [[ "$ENV_ALIAS" = "localnet" ]]; then
    cd "$PYTH_DIR/lazer/contracts/sui"
    printf "\n[environments]\nlocalnet = \"%s\"\n" "$CHAIN_ID" >>Move.toml
    cd "$WH_PKG_DIR"
    printf "\n[environments]\nlocalnet = \"%s\"\n" "$CHAIN_ID" >>Move.toml
fi

cd "$WH_PKG_DIR"
rm Published.toml
WORM_DEPLOY_OUT=$(
    sui client publish --environment "$ENV_ALIAS" --json 2>/dev/null
)

re='({.+})'
[[ "$WORM_DEPLOY_OUT" =~ $re ]] &&
    WH_PKG_ID=$(
        echo "${BASH_REMATCH[1]}" |
            jq -r '.objectChanges[] | select(.type == "published") | .packageId'
    )

object-url "$ENV_ALIAS" "$WH_PKG_ID"

WORM_INIT_OUT=$(
    worm sui init-wormhole \
        --network "$(if [[ $ENV_ALIAS == "localnet" ]]; then
            echo "devnet"
        else
            echo "$ENV_ALIAS"
        fi)" \
        --rpc "$ENV_RPC" \
        --package-id "$WH_PKG_ID" \
        --guardian-set-index "$GUARDIAN_SET_INDEX" \
        --initial-guardian "$GUARDIAN_SET" \
        --private-key "$WORM_KEY" \
        --debug
)

re='Wormhole state object ID (0x[0-9a-f]+)'
[[ "$WORM_INIT_OUT" =~ $re ]] &&
    WH_STATE_ID=${BASH_REMATCH[1]}

object-url "$ENV_ALIAS" "$WH_STATE_ID"

re='Transaction digest ([A-Za-z0-9]+)'
[[ "$WORM_INIT_OUT" =~ $re ]] &&
    WH_INIT_TX=${BASH_REMATCH[1]}

tx-url "$ENV_ALIAS" "$WH_INIT_TX"

cd "$CM_DIR"
pnpm turbo build
pnpm tsx scripts/manage_sui_lazer_contract.ts -c "$CHAIN" deploy \
    --private-key "$SUI_KEY" \
    --wormhole "$WH_STATE_ID"
