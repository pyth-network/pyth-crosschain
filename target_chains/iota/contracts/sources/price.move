module pyth::price {
    use pyth::i64::I64;

    /// A price with a degree of uncertainty, represented as a price +- a confidence interval.
    ///
    /// The confidence interval roughly corresponds to the standard error of a normal distribution.
    /// Both the price and confidence are stored in a fixed-point numeric representation,
    /// `x * (10^expo)`, where `expo` is the exponent.
    //
    /// Please refer to the documentation at https://docs.pyth.network/documentation/pythnet-price-feeds/best-practices for how
    /// to how this price safely.
    struct Price has copy, drop, store {
        price: I64,
        /// Confidence interval around the price
        conf: u64,
        /// The exponent
        expo: I64,
        /// Unix timestamp of when this price was computed
        timestamp: u64,
    }

    public fun new(price: I64, conf: u64, expo: I64, timestamp: u64): Price {
        Price {
            price,
            conf,
            expo,
            timestamp,
        }
    }

    public fun get_price(price: &Price): I64 {
        price.price
    }

    public fun get_conf(price: &Price): u64 {
        price.conf
    }

    public fun get_timestamp(price: &Price): u64 {
        price.timestamp
    }

    public fun get_expo(price: &Price): I64 {
        price.expo
    }
}
