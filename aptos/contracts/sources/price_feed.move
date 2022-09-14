module pyth::price_feed {
    use pyth::price_identifier::PriceIdentifier;
    use pyth::price_status::PriceStatus;
    use pyth::price::Price;

    /// PriceFeed represents a current aggregate price for a particular product.
    struct PriceFeed has copy, drop, store {
        /// The price identifier
        price_identifier: PriceIdentifier,
        /// The status of the current aggregate price
        status: PriceStatus,
        /// The current aggregate price
        price: Price,
        /// The current exponentially moving average aggregate price
        ema_price: Price,
        /// The most recent previous price with TRADING status
        previous_price: Price,
    }

    public fun new(
        price_identifier: PriceIdentifier,
        status: PriceStatus,
        price: Price,
        ema_price: Price,
        previous_price: Price): PriceFeed {
        PriceFeed {
            price_identifier: price_identifier,
            status: status,
            price: price,
            ema_price: ema_price,
            previous_price: previous_price
        }
    }

    public fun get_price_identifier(price_feed: &PriceFeed): &PriceIdentifier {
        &price_feed.price_identifier
    }

    public fun get_status(price_feed: &PriceFeed): PriceStatus {
        price_feed.status
    }

    public fun get_price(price_feed: &PriceFeed): Price {
        price_feed.price
    }

    public fun get_ema_price(price_feed: &PriceFeed): Price {
        price_feed.ema_price
    }

    public fun get_previous_price(price_feed: &PriceFeed): Price {
        price_feed.previous_price
    }
}
