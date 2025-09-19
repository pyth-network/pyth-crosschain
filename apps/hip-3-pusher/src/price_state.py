from loguru import logger
import time

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


class PriceState:
    """
    Maintain latest prices seen across listeners and publisher.
    """
    def __init__(self, config):
        self.stale_price_threshold_seconds = config.get("stale_price_threshold_seconds", DEFAULT_STALE_PRICE_THRESHOLD_SECONDS)
        now = time.time()

        self.hl_oracle_price = None
        self.hl_mark_price = None
        self.latest_hl_timestamp = now

        self.lazer_base_price = None
        self.lazer_base_exponent = config["lazer"]["base_feed_exponent"]
        self.lazer_quote_price = None
        self.lazer_quote_exponent = config["lazer"]["quote_feed_exponent"]
        self.latest_lazer_timestamp = now

        self.hermes_base_price = None
        self.hermes_base_exponent = config["hermes"]["base_feed_exponent"]
        self.hermes_quote_price = None
        self.hermes_quote_exponent = config["hermes"]["quote_feed_exponent"]
        self.latest_hermes_timestamp = now

    def get_current_oracle_price(self):
        now = time.time()
        if self.hl_oracle_price:
            time_diff = now - self.latest_hl_timestamp
            if time_diff < self.stale_price_threshold_seconds:
                return self.hl_oracle_price
            else:
                logger.error("Hyperliquid oracle price stale by {} seconds", time_diff)
        else:
            logger.error("Hyperliquid oracle price not received yet")

        # fall back to Hermes
        if self.hermes_base_price and self.hermes_quote_price:
            time_diff = now - self.latest_hermes_timestamp
            if time_diff < self.stale_price_threshold_seconds:
                return self.get_hermes_price()
            else:
                logger.error("Hermes price stale by {} seconds", time_diff)
        else:
            logger.error("Hermes base/quote prices not received yet")

        # fall back to Lazer
        if self.lazer_base_price and self.lazer_quote_price:
            time_diff = now - self.latest_lazer_timestamp
            if time_diff < self.stale_price_threshold_seconds:
                return self.get_lazer_price()
            else:
                logger.error("Lazer price stale by {} seconds", time_diff)
        else:
            logger.error("Lazer base/quote prices not received yet")

        logger.error("All prices missing or stale!")
        return None

    def get_hermes_price(self):
        base_price = float(self.hermes_base_price) / (10.0 ** -self.hermes_base_exponent)
        quote_price = float(self.hermes_quote_price) / (10.0 ** -self.hermes_quote_exponent)
        return str(round(base_price / quote_price, 2))

    def get_lazer_price(self):
        base_price = float(self.lazer_base_price) / (10.0 ** -self.lazer_base_exponent)
        quote_price = float(self.lazer_quote_price) / (10.0 ** -self.lazer_quote_exponent)
        return str(round(base_price / quote_price, 2))
