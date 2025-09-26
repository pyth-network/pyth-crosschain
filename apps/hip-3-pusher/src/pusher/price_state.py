from loguru import logger
import time

from pusher.config import Config

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


class PriceUpdate:
    def __init__(self, price, timestamp):
        self.price = price
        self.timestamp = timestamp

    def __str__(self):
        return f"PriceUpdate(price={self.price}, timestamp={self.timestamp})"

    def time_diff(self, now):
        return now - self.timestamp


class PriceState:
    """
    Maintain latest prices seen across listeners and publisher.
    """
    def __init__(self, config: Config):
        self.stale_price_threshold_seconds = config.stale_price_threshold_seconds

        self.hl_oracle_price: PriceUpdate | None = None
        self.hl_mark_price: PriceUpdate | None = None

        self.lazer_base_price: PriceUpdate | None = None
        self.lazer_base_exponent = config.lazer.base_feed_exponent
        self.lazer_quote_price: PriceUpdate | None = None
        self.lazer_quote_exponent = config.lazer.quote_feed_exponent

        self.hermes_base_price: PriceUpdate | None = None
        self.hermes_base_exponent = config.hermes.base_feed_exponent
        self.hermes_quote_price: PriceUpdate | None = None
        self.hermes_quote_exponent = config.hermes.quote_feed_exponent

    def get_current_oracle_price(self):
        now = time.time()
        if self.hl_oracle_price:
            time_diff = self.hl_oracle_price.time_diff(now)
            if time_diff < self.stale_price_threshold_seconds:
                return self.hl_oracle_price.price
            else:
                logger.error("Hyperliquid oracle price stale by {} seconds", time_diff)
        else:
            logger.error("Hyperliquid oracle price not received yet")

        # fall back to Lazer
        if self.lazer_base_price and self.lazer_quote_price:
            max_time_diff = max(self.lazer_base_price.time_diff(now), self.lazer_quote_price.time_diff(now))
            if max_time_diff < self.stale_price_threshold_seconds:
                return self.get_lazer_price()
            else:
                logger.error("Lazer price stale by {} seconds", max_time_diff)
        else:
            logger.error("Lazer base/quote prices not received yet")

        # fall back to Hermes
        if self.hermes_base_price and self.hermes_quote_price:
            max_time_diff = max(self.hermes_base_price.time_diff(now), self.hermes_quote_price.time_diff(now))
            if max_time_diff < self.stale_price_threshold_seconds:
                return self.get_hermes_price()
            else:
                logger.error("Hermes price stale by {} seconds", max_time_diff)
        else:
            logger.error("Hermes base/quote prices not received yet")

        logger.error("All prices missing or stale!")
        return None

    def get_hermes_price(self):
        base_price = float(self.hermes_base_price.price) / (10.0 ** -self.hermes_base_exponent)
        quote_price = float(self.hermes_quote_price.price) / (10.0 ** -self.hermes_quote_exponent)
        return str(round(base_price / quote_price, 2))

    def get_lazer_price(self):
        base_price = float(self.lazer_base_price.price) / (10.0 ** -self.lazer_base_exponent)
        quote_price = float(self.lazer_quote_price.price) / (10.0 ** -self.lazer_quote_exponent)
        return str(round(base_price / quote_price, 2))
