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

# The mock publisher needs to fund the publisher identity account,
# unable to use a separate payer
SOL_AIRDROP_AMT = int(os.environ.get("SOL_AIRDROP_AMT", 0))


class PythAccEndpoint(BaseHTTPRequestHandler):
    """
    A dumb endpoint to respond with a JSON containing Pyth symbol and mapping addresses
    """

    def do_GET(self):
        print(f"Got path {self.path}")
        sys.stdout.flush()
        data = json.dumps(HTTP_ENDPOINT_DATA).encode("utf-8")
        print(f"Sending:\n{data}")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()

# Test publisher state that gets served via the HTTP endpoint. Note: the schema of this dict is extended here and there
# all_symbols_added is set to True once all dynamically-created symbols are added to the on-chain program. This
# flag allows the integration test in check_attestations.py to determine that every on-chain symbol is being attested.
HTTP_ENDPOINT_DATA = {"symbols": [], "mapping_address": None, "all_symbols_added": False}


def publisher_random_update(price_pubkey):
    """
    Update the specified price with random values
    """
    value = random.randrange(1000, 2000)
    confidence = random.randrange(1, 10)
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
    """
    NOTE: Updates HTTP_ENDPOINT_DATA
    """
    symbol_name = f"Test symbol {num}"
    # Add a product
    prod_pubkey = pyth_admin_run_or_die(
        "add_product", capture_output=True).stdout.strip()

    print(f"{symbol_name}: Added product {prod_pubkey}")

    # Add a price
    price_pubkey = pyth_admin_run_or_die(
        "add_price",
        args=[prod_pubkey, "price"],
        capture_output=True
    ).stdout.strip()

    print(f"{symbol_name}: Added price {price_pubkey}")

    # Become a publisher for the new price
    pyth_admin_run_or_die(
        "add_publisher", args=[publisher_pubkey, price_pubkey],
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

    HTTP_ENDPOINT_DATA["symbols"].append(sym)

    sys.stdout.flush()

    print(f"New symbol: {num}")

    return num

# Fund the publisher
sol_run_or_die("airdrop", [
    str(SOL_AIRDROP_AMT),
    "--keypair", PYTH_PUBLISHER_KEYPAIR,
    "--commitment", "finalized",
])

# Create a mapping
pyth_admin_run_or_die("init_mapping", debug=True, capture_output=True)

mapping_addr = sol_run_or_die("address", args=[
    "--keypair", PYTH_MAPPING_KEYPAIR
], capture_output=True).stdout.strip()

HTTP_ENDPOINT_DATA["mapping_addr"] = mapping_addr

print(f"New mapping at {mapping_addr}")

print(f"Creating {PYTH_TEST_SYMBOL_COUNT} test Pyth symbols")

publisher_pubkey = sol_run_or_die("address", args=[
    "--keypair", PYTH_PUBLISHER_KEYPAIR
], capture_output=True).stdout.strip()

with ThreadPoolExecutor(max_workers=PYTH_TEST_SYMBOL_COUNT) as executor:
    add_symbol_futures = {executor.submit(add_symbol, sym_id) for sym_id in range(PYTH_TEST_SYMBOL_COUNT)}

    for future in as_completed(add_symbol_futures):
        print(f"Completed {future.result()}")

print(
    f"Mock updates ready to roll. Updating every {str(PYTH_PUBLISHER_INTERVAL_SECS)} seconds")

# Spin off the readiness probe endpoint into a separate thread
readiness_thread = threading.Thread(target=readiness, daemon=True)

# Start an HTTP endpoint for looking up test product/price addresses
http_service = threading.Thread(target=accounts_endpoint, daemon=True)

readiness_thread.start()
http_service.start()

next_new_symbol_id = PYTH_TEST_SYMBOL_COUNT
last_new_sym_added_at = time.monotonic()

with ThreadPoolExecutor() as executor: # Used for async adding of products and prices
    dynamically_added_symbols = 0
    while True:
        for sym in HTTP_ENDPOINT_DATA["symbols"]:
            publisher_random_update(sym["price"])

        # Add a symbol if new symbol interval configured. This will add a new symbol if PYTH_NEW_SYMBOL_INTERVAL_SECS
        # is passed since adding the previous symbol. The second constraint ensures that
        # at most PYTH_DYNAMIC_SYMBOL_COUNT new price symbols are created.
        if PYTH_NEW_SYMBOL_INTERVAL_SECS > 0 and dynamically_added_symbols  < PYTH_DYNAMIC_SYMBOL_COUNT:
            # Do it if enough time passed
            now = time.monotonic()
            if (now - last_new_sym_added_at) >= PYTH_NEW_SYMBOL_INTERVAL_SECS:
                executor.submit(add_symbol, next_new_symbol_id) # Returns immediately, runs in background
                last_sym_added_at = now
                next_new_symbol_id += 1
                dynamically_added_symbols += 1

        if dynamically_added_symbols >= PYTH_DYNAMIC_SYMBOL_COUNT:
            HTTP_ENDPOINT_DATA["all_symbols_added"] = True

        time.sleep(PYTH_PUBLISHER_INTERVAL_SECS)
        sys.stdout.flush()


readiness_thread.join()
http_service.join()
