class PriceState:
    """
    Maintain latest prices seen across listeners and publisher.
    """
    def __init__(self):
        self.latest_oracle_price = None
        self.latest_mark_price = None
        self.lazer_base_price = None
        self.lazer_quote_price = None
        self.hermes_base_price = None
        self.hermes_quote_price = None
