import streamlit as st
import json
import yaml

EVM_CHAINS_YAML = "/Users/tejasbadadare/dev/pyth-crosschain/contract_manager/store/chains/EvmChains.yaml"
RECEIVER_CHAINS_JSON = "/Users/tejasbadadare/dev/pyth-crosschain/governance/xc_admin/packages/xc_admin_common/src/receiver_chains.json"

MAINNET_ID_MIN = 60000
MAINNET_ID_MAX = 69999
TESTNET_ID_MIN = 50000
TESTNET_ID_MAX = 59999


def update_evm_chains_yml(is_mainnet: bool, chain_name: str, rpc_url: str) -> None:
    """Updates EvmChains.yaml with a new chain entry"""
    new_chain = {
        "id": chain_name,
        "mainnet": is_mainnet,
        "rpcUrl": rpc_url,
        "networkId": 0,  # TODO: fetch from network
        "type": "EvmChain",
    }

    with open(EVM_CHAINS_YAML, "r") as f:
        evm_chains: list[dict[str, str]] = yaml.safe_load(f)

    evm_chains.append(new_chain)

    with open(EVM_CHAINS_YAML, "w") as f:
        yaml.dump(evm_chains, f, sort_keys=False)

    st.success(f"✏️ Added {chain_name} to EvmChains.yaml")


def update_receiver_chains_json(is_mainnet, chain_name):
    """Updates receiver_chains.json with a new chain entry using an auto-incremented ID"""
    with open(RECEIVER_CHAINS_JSON, "r") as f:
        receiver_chains = json.load(f)

    network_type = "mainnet" if is_mainnet else "non_mainnet"
    ids = receiver_chains[network_type]

    # Get next available ID based on network type
    def _get_next_chain_id(existing_ids, id_min, id_max):
        current_max = max(
            (id for id in existing_ids if id_min <= id <= id_max), default=(id_min - 1)
        )
        return max(id_min, current_max + 1)

    if is_mainnet:
        next_id = _get_next_chain_id(ids.values(), MAINNET_ID_MIN, MAINNET_ID_MAX)
    else:
        next_id = _get_next_chain_id(ids.values(), TESTNET_ID_MIN, TESTNET_ID_MAX)

    receiver_chains[network_type][chain_name] = next_id

    with open(RECEIVER_CHAINS_JSON, "w") as f:
        json.dump(receiver_chains, f, indent=2)

    st.success(f"✏️ Added {chain_name} to receiver_chains.json")


def update_files(is_mainnet, chain_name, rpc_url):
    update_evm_chains_yml(is_mainnet, chain_name, rpc_url)
    update_receiver_chains_json(is_mainnet, chain_name)
