#!/usr/bin/env python3

from pyth_utils import *

from http.server import HTTPServer, BaseHTTPRequestHandler
from concurrent.futures import ThreadPoolExecutor, as_completed

import json
import os
import random
import sys
import threading
import time

PYTH_TEST_SYMBOL_COUNT = int(os.environ.get("PYTH_TEST_SYMBOL_COUNT", "9"))

class PythAccEndpoint(BaseHTTPRequestHandler):
    """
    A dumb endpoint to respond with a JSON containing Pyth account addresses
    """

    def do_GET(self):
        print(f"Got path {self.path}")
        sys.stdout.flush()
        data = json.dumps(TEST_SYMBOLS).encode("utf-8")
        print(f"Sending:\n{data}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()


TEST_SYMBOLS = []


def publisher_random_update(price_pubkey):
    """
    Update the specified price with random values
    """
    value = random.randrange(1024)
    confidence = 5
    pyth_run_or_die("upd_price_val", args=[
        price_pubkey, str(value), str(confidence), "trading"
    ])
    print(f"Price {price_pubkey} value updated to {str(value)}!")


def accounts_endpoint():
    """
    Run a barebones HTTP server to share the dynamic Pyth
    mapping/product/price account addresses
    """
    server_address = ('', 4242)
    httpd = HTTPServer(server_address, PythAccEndpoint)
    httpd.serve_forever()


def add_symbol(num: int):
    symbol_name = f"Test symbol {num}"
    # Add a product
    prod_pubkey = pyth_run_or_die(
        "add_product", capture_output=True).stdout.strip()

    print(f"{symbol_name}: Added product {prod_pubkey}")

    # Add a price
    price_pubkey = pyth_run_or_die(
        "add_price",
        args=[prod_pubkey, "price"],
        confirm=False,
        capture_output=True
    ).stdout.strip()

    print(f"{symbol_name}: Added price {price_pubkey}")

    # Become a publisher for the new price
    pyth_run_or_die(
        "add_publisher", args=[publisher_pubkey, price_pubkey],
        confirm=False,
        debug=True,
        capture_output=True)
    print(f"{symbol_name}: Added publisher {publisher_pubkey}")

    # Update the prices as the newly added publisher 
    publisher_random_update(price_pubkey)

    sym = {
        "name": symbol_name,
        "product": prod_pubkey,
        "price": price_pubkey
    }

    TEST_SYMBOLS.append(sym)

    sys.stdout.flush()

    return num


# Fund the publisher
sol_run_or_die("airdrop", [
    str(SOL_AIRDROP_AMT),
    "--keypair", PYTH_PUBLISHER_KEYPAIR,
    "--commitment", "finalized",
])

# Create a mapping
pyth_run_or_die("init_mapping")

print(f"Creating {PYTH_TEST_SYMBOL_COUNT} test Pyth symbols")

publisher_pubkey = sol_run_or_die("address", args=[
    "--keypair", PYTH_PUBLISHER_KEYPAIR
], capture_output=True).stdout.strip()

with ThreadPoolExecutor(max_workers=10) as executor:
    add_symbol_futures = {executor.submit(add_symbol, sym_id) for sym_id in range(PYTH_TEST_SYMBOL_COUNT)}
    
    for future in as_completed(add_symbol_futures):
        print(f"Completed {future.result()}")

print(
    f"Mock updates ready to roll. Updating every {str(PYTH_PUBLISHER_INTERVAL)} seconds")

# Spin off the readiness probe endpoint into a separate thread
readiness_thread = threading.Thread(target=readiness, daemon=True)

# Start an HTTP endpoint for looking up test product/price addresses
http_service = threading.Thread(target=accounts_endpoint, daemon=True)

readiness_thread.start()
http_service.start()

while True:
    for sym in TEST_SYMBOLS:
        publisher_random_update(sym["price"])

    time.sleep(PYTH_PUBLISHER_INTERVAL)
    sys.stdout.flush()

readiness_thread.join()
http_service.join()
