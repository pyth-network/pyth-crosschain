#!/usr/bin/env python3

# This script sets up a simple loop for periodical attestation of Pyth data
import json
import logging
import os
import re
import sys
import threading
import time
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, HTTPServer
from subprocess import PIPE, STDOUT, Popen

from pyth_utils import *

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s | %(module)s | %(levelname)s | %(message)s"
)

P2W_SOL_ADDRESS = os.environ.get(
    "P2W_SOL_ADDRESS", "P2WH424242424242424242424242424242424242424"
)
P2W_OWNER_KEYPAIR = os.environ.get(
    "P2W_OWNER_KEYPAIR", "/usr/src/solana/keys/p2w_owner.json"
)
P2W_ATTESTATIONS_PORT = int(os.environ.get("P2W_ATTESTATIONS_PORT", 4343))
P2W_INITIALIZE_SOL_CONTRACT = os.environ.get("P2W_INITIALIZE_SOL_CONTRACT", None)

PYTH_TEST_ACCOUNTS_HOST = "pyth"
PYTH_TEST_ACCOUNTS_PORT = 4242

P2W_ATTESTATION_CFG = os.environ.get("P2W_ATTESTATION_CFG", None)

WORMHOLE_ADDRESS = os.environ.get(
    "WORMHOLE_ADDRESS", "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"
)

P2W_MAX_LOG_LINES = int(os.environ.get("P2W_MAX_LOG_LINES", 1000))

ATTESTATIONS = {
    "pendingSeqnos": [],
}

SEQNO_REGEX = re.compile(r"Sequence number: (\d+)")



class P2WAutoattestStatusEndpoint(BaseHTTPRequestHandler):
    """
    A dumb endpoint for last attested price metadata.
    """

    def do_GET(self):
        logging.info(f"Got path {self.path}")
        sys.stdout.flush()
        data = json.dumps(ATTESTATIONS).encode("utf-8")
        logging.debug(f"Sending: {data}")

        ATTESTATIONS["pendingSeqnos"] = []

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()


def serve_attestations():
    """
    Run a barebones HTTP server to share Pyth2wormhole attestation history
    """
    server_address = ("", P2W_ATTESTATIONS_PORT)
    httpd = HTTPServer(server_address, P2WAutoattestStatusEndpoint)
    httpd.serve_forever()


if SOL_AIRDROP_AMT > 0:
    # Fund the p2w owner
    sol_run_or_die(
        "airdrop",
        [
            str(SOL_AIRDROP_AMT),
            "--keypair",
            P2W_OWNER_KEYPAIR,
            "--commitment",
            "finalized",
        ],
    )

def find_and_log_seqnos(s):
    # parse seqnos
    matches = SEQNO_REGEX.findall(s)

    seqnos = list(map(lambda m: int(m), matches))

    ATTESTATIONS["pendingSeqnos"] += seqnos

    if len(seqnos) > 0:
        logging.info(f"{len(seqnos)} batch seqno(s) received: {seqnos})")

if P2W_INITIALIZE_SOL_CONTRACT is not None:
    # Get actor pubkeys
    P2W_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", P2W_OWNER_KEYPAIR], capture_output=True
    ).stdout.strip()
    PYTH_OWNER_ADDRESS = sol_run_or_die(
        "address", ["--keypair", PYTH_PROGRAM_KEYPAIR], capture_output=True
    ).stdout.strip()

    init_result = run_or_die(
        [
            "pyth2wormhole-client",
            "--log-level",
            "4",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            P2W_OWNER_KEYPAIR,
            "init",
            "--wh-prog",
            WORMHOLE_ADDRESS,
            "--owner",
            P2W_OWNER_ADDRESS,
            "--pyth-owner",
            PYTH_OWNER_ADDRESS,
        ],
        capture_output=True,
        die=False,
    )

    if init_result.returncode != 0:
        logging.error(
            "NOTE: pyth2wormhole-client init failed, retrying with set_config"
        )
        run_or_die(
            [
                "pyth2wormhole-client",
                "--log-level",
                "4",
                "--p2w-addr",
                P2W_SOL_ADDRESS,
                "--rpc-url",
                SOL_RPC_URL,
                "--payer",
                P2W_OWNER_KEYPAIR,
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
    conn = HTTPConnection(PYTH_TEST_ACCOUNTS_HOST, PYTH_TEST_ACCOUNTS_PORT)

    conn.request("GET", "/")

    res = conn.getresponse()

    pyth_accounts = None

    if res.getheader("Content-Type") == "application/json":
        pyth_accounts = json.load(res)
    else:
        logging.error("Bad Content type")
        sys.exit(1)

    logging.info(
        f"Retrieved {len(pyth_accounts)} Pyth accounts from endpoint: {pyth_accounts}"
    )

    cfg_yaml = """
---
symbol_groups:
  - group_name: things
    conditions:
      min_freq_secs: 17
    symbols:
"""

    # integer-divide the symbols in ~half for two test
    # groups. Assumes arr[:idx] is exclusive, and arr[idx:] is
    # inclusive
    half_len = len(pyth_accounts) // 2;

    for thing in pyth_accounts[:half_len]:
        name = thing["name"]
        price = thing["price"]
        product = thing["product"]

        cfg_yaml += f"""
      - name: {name}
        price_addr: {price}
        product_addr: {product}"""

    cfg_yaml += f"""
  - group_name: stuff
    conditions:
      min_freq_secs: 19
    symbols:
"""

    for stuff in pyth_accounts[half_len:]:
        name = stuff["name"]
        price = stuff["price"]
        product = stuff["product"]

        cfg_yaml += f"""
      - name: {name}
        price_addr: {price}
        product_addr: {product}"""

    with open(P2W_ATTESTATION_CFG, "w") as f:
        f.write(cfg_yaml)
        f.flush()


# Send the first attestation in one-shot mode for testing
first_attest_result = run_or_die(
    [
        "pyth2wormhole-client",
        "--log-level",
        "4",
        "--p2w-addr",
        P2W_SOL_ADDRESS,
        "--rpc-url",
        SOL_RPC_URL,
        "--payer",
        P2W_OWNER_KEYPAIR,
        "attest",
        "-f",
        P2W_ATTESTATION_CFG,
    ],
    capture_output=True,
)

logging.info("p2w_autoattest ready to roll!")

find_and_log_seqnos(first_attest_result.stdout)

# Serve p2w endpoint
endpoint_thread = threading.Thread(target=serve_attestations, daemon=True)
endpoint_thread.start()

# Let k8s know the service is up
readiness_thread = threading.Thread(target=readiness, daemon=True)
readiness_thread.start()


# Do not exit this script if a continuous attestation stops for
# whatever reason (this avoids k8s restart penalty)
while True:
    # Start the child process in daemon mode
    p2w_client_process = Popen(
        [
            "pyth2wormhole-client",
            "--log-level",
            "4",
            "--p2w-addr",
            P2W_SOL_ADDRESS,
            "--rpc-url",
            SOL_RPC_URL,
            "--payer",
            P2W_OWNER_KEYPAIR,
            "attest",
            "-f",
            P2W_ATTESTATION_CFG,
            "-d",
        ],
        stdout=PIPE,
        stderr=STDOUT,
        text=True,
        )

    saved_log_lines = []

    # Keep listening for seqnos until the program exits
    while p2w_client_process.poll() is None:
        line = p2w_client_process.stdout.readline()
        
        # Always pass output to the debug level
        logging.debug(f"pyth2wormhole-client: {line}")

        find_and_log_seqnos(line)

        # Extend with new line
        saved_log_lines.append(line)

        # trim back to specified maximum
        if len(saved_log_lines) > P2W_MAX_LOG_LINES:
            saved_log_lines.pop(0)
        

    # Yell if the supposedly non-stop attestation process exits
    logging.warn(f"pyth2wormhole-client stopped unexpectedly with code {p2w_client_process.retcode}")
    logging.warn(f"Last {len(saved_log_lines)} log lines:\n{(saved_log_lines)}")
