#!/usr/bin/env python3

# This script sets up a simple loop for periodical attestation of Pyth data
import argparse
import json
import logging
import re
import sys
import threading
import time
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, HTTPServer

import yaml
from pyth_utils import *

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s | %(module)s | %(levelname)s | %(message)s"
)

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Pyth2Wormhole autoattest",
)
parser.add_argument(
    "-f",
    "--file",
    required=True,
    type=argparse.FileType("r"),
    help="Pyth2wormhole config file",
)
args = parser.parse_args()
config = yaml.safe_load(args.file)

P2W_SOL_ADDRESS = config.get("P2W_SOL_ADDRESS", "asdas")
P2W_ATTEST_INTERVAL = config.get("P2W_ATTEST_INTERVAL", 5)
P2W_OWNER_KEYPAIR = config.get(
    "P2W_OWNER_KEYPAIR", "/usr/src/solana/keys/p2w_owner.json"
)
P2W_ATTESTATIONS_PORT = config.get("P2W_ATTESTATIONS_PORT", 4343)
P2W_INITIALIZE_SOL_CONTRACT = config.get("P2W_INITIALIZE_SOL_CONTRACT", None)
PYTH_PRICE_ACCOUNT = config.get("PYTH_PRICE_ACCOUNT", None)
PYTH_PRODUCT_ACCOUNT = config.get("PYTH_PRODUCT_ACCOUNT", None)
PYTH_ACCOUNTS_HOST = "pyth"
PYTH_ACCOUNTS_PORT = 4242
WORMHOLE_ADDRESS = config.get(
    "WORMHOLE_ADDRESS", "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o"
)
PYTH = config.get("PYTH", "./pythd")
PYTH_KEY_STORE = config.get("/home/pyth/.pythd")
PYTH_PROGRAM_KEYPAIR = config.get(
    "PYTH_PROGRAM_KEYPAIR", f"{PYTH_KEY_STORE}/publish_key_pair.json"
)
PYTH_PROGRAM_SO_PATH = config.get("PYTH_PROGRAM_SO_PATH", "../target/oracle.so")
PYTH_PUBLISHER_KEYPAIR = config.get("", f"{PYTH_KEY_STORE}/publish_key_pair.json")
PYTH_PUBLISHER_INTERVAL = config.get("PYTH_PUBLISHER_INTERVAL", float(5))
# 0 setting disables airdropping
SOL_AIRDROP_AMT = config.get("SOL_AIRDROP_AMT", 0)
# SOL RPC settings
SOL_RPC_HOST = config.get("SOL_RPC_HOST", "solana-devnet")
SOL_RPC_PORT = config.get("SOL_RPC_PORT", 8899)
SOL_RPC_URL = config.get("SOL_RPC_URL", "{0}:{1}".format(SOL_RPC_HOST, SOL_RPC_PORT))
READINESS_PORT = config.get("READINESS_PORT", 2000)
# Settings specific to local devnet Pyth instance

ATTESTATIONS = {
    "pendingSeqnos": [],
}


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


if P2W_INITIALIZE_SOL_CONTRACT is not None:
    # Get actor pubkeys
    P2W_OWNER_ADDRESS = sol_run_or_die(
        [PYTH, "address"],
        ["--keypair", P2W_OWNER_KEYPAIR, "--url", SOL_RPC_URL],
        capture_output=True,
    ).stdout.strip()
    PYTH_OWNER_ADDRESS = sol_run_or_die(
        [PYTH, "address"], ["--keypair", PYTH_PROGRAM_KEYPAIR], capture_output=True
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

# Retrieve current price/product pubkeys from the pyth publisher if not provided in envs
if PYTH_PRICE_ACCOUNT is None or PYTH_PRODUCT_ACCOUNT is None:
    conn = HTTPConnection(PYTH_ACCOUNTS_HOST, PYTH_ACCOUNTS_PORT)

    conn.request("GET", "/")

    res = conn.getresponse()

    pyth_accounts = None

    if res.getheader("Content-Type") == "application/json":
        pyth_accounts = json.load(res)
    else:
        logging.error("Bad Content type")
        sys.exit(1)

    PYTH_PRICE_ACCOUNT = pyth_accounts["price"]
    PYTH_PRODUCT_ACCOUNT = pyth_accounts["product"]
    logging.info(f"Retrieved Pyth accounts from endpoint: {pyth_accounts}")

nonce = 0
attest_result = run_or_die(
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
        "--price",
        PYTH_PRICE_ACCOUNT,
        "--product",
        PYTH_PRODUCT_ACCOUNT,
        "--nonce",
        str(nonce),
    ],
    capture_output=True,
)

logging.info("p2w_autoattest ready to roll!")
logging.info(f"Attest Interval: {P2W_ATTEST_INTERVAL}")

# Serve p2w endpoint
endpoint_thread = threading.Thread(target=serve_attestations, daemon=True)
endpoint_thread.start()

# Let k8s know the service is up
readiness_thread = threading.Thread(target=readiness(READINESS_PORT), daemon=True)
readiness_thread.start()

seqno_regex = re.compile(r"^Sequence number: (\d+)")

nonce = 1
while True:
    attest_result = run_or_die(
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
            "--price",
            PYTH_PRICE_ACCOUNT,
            "--product",
            PYTH_PRODUCT_ACCOUNT,
            "--nonce",
            str(nonce),
        ],
        capture_output=True,
    )
    matches = seqno_regex.match(attest_result.stdout)

    if matches is not None:
        seqno = int(matches.group(1))
        logging.info(f"Got seqno: {seqno}")

        ATTESTATIONS["pendingSeqnos"].append(seqno)

    else:
        logging.warn("Warning: Could not get sequence number")

    time.sleep(P2W_ATTEST_INTERVAL)
    nonce += 1
