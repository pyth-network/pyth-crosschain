#!/usr/bin/env python3

# This script sets up a simple loop for periodical attestation of Pyth data
import json
import logging
import os
import re
import sys
import threading
from http.client import HTTPConnection
from subprocess import PIPE, STDOUT, Popen

from pyth_utils import *

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s | %(module)s | %(levelname)s | %(message)s"
)

P2W_SOL_ADDRESS = os.environ.get(
    "P2W_SOL_ADDRESS", "P2WH424242424242424242424242424242424242424"
)
P2W_OWNER_KEYPAIR = os.environ.get(
    "P2W_OWNER_KEYPAIR", "/solana-secrets/p2w_owner.json"
)
P2W_ATTESTATIONS_PORT = int(os.environ.get("P2W_ATTESTATIONS_PORT", 4343))
P2W_INITIALIZE_SOL_CONTRACT = os.environ.get("P2W_INITIALIZE_SOL_CONTRACT", None)

PYTH_TEST_ACCOUNTS_HOST = "pyth"
PYTH_TEST_ACCOUNTS_PORT = 4242

P2W_ATTESTATION_CFG = os.environ.get("P2W_ATTESTATION_CFG", None)

WORMHOLE_ADDRESS = os.environ.get(
    "WORMHOLE_ADDRESS", "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"
)

# attester needs string, but we validate as int first
P2W_RPC_TIMEOUT_SECS = str(int(os.environ.get("P2W_RPC_TIMEOUT_SECS", "20")))


if P2W_INITIALIZE_SOL_CONTRACT is not None:
    # Get actor pubkeys
    P2W_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", P2W_OWNER_KEYPAIR], capture_output=True
    ).stdout.strip()
    PYTH_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", PYTH_PROGRAM_KEYPAIR], capture_output=True,
    ).stdout.strip()

    init_result = run_or_die(
        [
            "pwhac",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            SOL_PAYER_KEYPAIR,
            "init",
            "--wh-prog",
            WORMHOLE_ADDRESS,
            "--owner",
            P2W_OWNER_ADDRESS,
            "--pyth-owner",
            PYTH_OWNER_ADDRESS,
        ],
        capture_output=True,
        debug=True,
        die=False,
    )

    if init_result.returncode != 0:
        logging.error(
            "NOTE: pwhac init failed, retrying with set_config"
        )
        run_or_die(
            [
                "pwhac",
                "--p2w-addr",
                P2W_SOL_ADDRESS,
                "--rpc-url",
                SOL_RPC_URL,
                "--payer",
                SOL_PAYER_KEYPAIR,
                "set-config",
                "--owner",
                P2W_OWNER_KEYPAIR,
                "--new-owner",
                P2W_OWNER_ADDRESS,
                "--new-wh-prog",
                WORMHOLE_ADDRESS,
                "--new-pyth-owner",
                PYTH_OWNER_ADDRESS,
            ],
            capture_output=True,
        )

# Retrieve available symbols from the test pyth publisher if not provided in envs
if P2W_ATTESTATION_CFG is None:
    P2W_ATTESTATION_CFG = "./attestation_cfg_test.yaml"
    publisher_state_map = get_pyth_accounts(PYTH_TEST_ACCOUNTS_HOST, PYTH_TEST_ACCOUNTS_PORT)
    pyth_accounts = publisher_state_map["symbols"]

    logging.info(
        f"Retrieved {len(pyth_accounts)} Pyth accounts from endpoint: {pyth_accounts}"
    )

    mapping_addr = publisher_state_map["mapping_addr"]

    cfg_yaml = f"""
---
mapping_addr: {mapping_addr}
mapping_reload_interval_mins: 1 # Very fast for testing purposes
min_rpc_interval_ms: 0 # RIP RPC
max_batch_jobs: 1000 # Where we're going there's no oomkiller
default_attestation_conditions:
  min_interval_secs: 10
symbol_groups:
  - group_name: fast_interval_rate_limited
    conditions:
      min_interval_secs: 1
      rate_limit_interval_secs: 2
    symbols:
"""

    # integer-divide the symbols in ~half for two test
    # groups. Assumes arr[:idx] is exclusive, and arr[idx:] is
    # inclusive
    third_len = len(pyth_accounts) // 3;

    for thing in pyth_accounts[:third_len]:
        name = thing["name"]
        price = thing["price"]
        product = thing["product"]

        cfg_yaml += f"""
      - type: key
        name: {name}
        price: {price}
        product: {product}"""

    # End of fast_interval_only

    cfg_yaml += f"""
  - group_name: longer_interval_sensitive_changes
    conditions:
      min_interval_secs: 3
      price_changed_bps: 300
    symbols:
"""

    for stuff in pyth_accounts[third_len:-third_len]:
        name = stuff["name"]
        price = stuff["price"]
        product = stuff["product"]

        cfg_yaml += f"""
      - type: key
        name: {name}
        price: {price}
        product: {product}"""

    with open(P2W_ATTESTATION_CFG, "w") as f:
        f.write(cfg_yaml)
        f.flush()


# Set helpfully chatty logging default, filtering especially annoying
# modules like async HTTP requests and tokio runtime logs
os.environ["RUST_LOG"] = os.environ.get("RUST_LOG", "info")

# Do not exit this script if a continuous attestation stops for
# whatever reason (this avoids k8s restart penalty)
while True:
    # Start the child process in daemon mode
    pwhac_process = Popen(
        [
            "pwhac",
            "--commitment",
            "confirmed",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            SOL_PAYER_KEYPAIR,
            "attest",
            "-f",
            P2W_ATTESTATION_CFG,
            "--timeout",
            P2W_RPC_TIMEOUT_SECS,
        ]
    )

    # Wait for an unexpected process exit
    retcode = pwhac_process.wait()

    # Yell if the supposedly non-stop attestation process exits
    logging.warn(f"pwhac stopped unexpectedly with code {retcode}")
