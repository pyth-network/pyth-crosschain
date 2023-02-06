#!/usr/bin/env python3

# This script is a CI test in tilt that verifies that prices are flowing through the entire system properly.
# It checks that all prices being published by the pyth publisher are showing up at the price service.
import base58
import logging
import time
from pyth_utils import *

logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s | %(module)s | %(levelname)s | %(message)s"
)

# Where to read the set of accounts from
PYTH_TEST_ACCOUNTS_HOST = "pyth"
PYTH_TEST_ACCOUNTS_PORT = 4242

PRICE_SERVICE_HOST = "pyth-price-server"
PRICE_SERVICE_PORT = 4200

def base58_to_hex(base58_string):
    asc_string = base58.b58decode(base58_string)
    return asc_string.hex()

all_prices_attested = False
while not all_prices_attested:
    publisher_state_map = get_pyth_accounts(PYTH_TEST_ACCOUNTS_HOST, PYTH_TEST_ACCOUNTS_PORT)
    pyth_price_account_ids = sorted([base58_to_hex(x["price"]) for x in publisher_state_map["symbols"]])
    price_ids = sorted(get_json(PRICE_SERVICE_HOST, PRICE_SERVICE_PORT, "/api/price_feed_ids"))

    if price_ids == pyth_price_account_ids:
        if publisher_state_map["all_symbols_added"]:
            logging.info("Price ids match and all symbols added. Enabling readiness probe")
            all_prices_attested = True
        else:
            logging.info("Price ids match but still waiting for more symbols to come online.")
    else:
        logging.info("Price ids do not match")
        logging.info(f"published ids: {pyth_price_account_ids}")
        logging.info(f"attested ids: {price_ids}")

    time.sleep(10)

# Let k8s know the service is up
readiness()
