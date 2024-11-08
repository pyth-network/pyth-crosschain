use {
    near_sdk::{
        borsh::{self, BorshDeserialize, BorshSerialize},
        env, is_promise_success, log, near_bindgen, AccountId, Gas, PanicOnDefault, Promise,
    },
    pyth::state::{Price, PriceIdentifier},
};

/// Our contract simply processes prices, so for now the only state we
/// need is the Pyth contract ID from which we will be fetching prices.
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct PythExample {
    pyth: AccountId,
}

#[near_bindgen]
impl PythExample {
    #[init]
    #[allow(clippy::new_without_default)]
    pub fn new(pyth: AccountId) -> Self {
        Self { pyth }
    }

    /// Example of submitting an update + request for multiple Price Feeds.
    #[payable]
    pub fn example_price_usage(
        &mut self,
        identifiers: Vec<PriceIdentifier>,
        data: String,
    ) -> Promise {
        pyth::ext::ext_pyth::ext(self.pyth.clone())
            .with_static_gas(Gas(30_000_000_000_000))
            .with_attached_deposit(env::attached_deposit())
            .update_price_feeds(data)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(10_000_000_000))
                    .handle_update_callback(identifiers),
            )
    }

    /// Handle the case where prices successfully updated, we can start reads at this point.
    #[payable]
    #[private]
    pub fn handle_update_callback(&mut self, mut identifiers: Vec<PriceIdentifier>) -> Promise {
        if !is_promise_success() {
            panic!("Failed to Update Prices");
        }

        // Fetch a few prices to use.
        let price_1 = identifiers.pop().unwrap();
        let price_2 = identifiers.pop().unwrap();
        let price_1 = pyth::ext::ext_pyth::ext(self.pyth.clone()).get_price(price_1);
        let price_2 = pyth::ext::ext_pyth::ext(self.pyth.clone()).get_price(price_2);

        // Start parallel reads.
        price_1.and(price_2).then(
            Self::ext(env::current_account_id())
                .with_static_gas(Gas(10_000_000_000))
                .handle_results_callback(),
        )
    }

    /// Handle results of reading multiple prices, the prices can be accessed using
    /// NEAR's env::promise_* functions.
    #[private]
    #[handle_result]
    pub fn handle_results_callback(
        &self,
        #[callback_result] price_1: Result<Price, near_sdk::PromiseError>,
        #[callback_result] price_2: Result<Price, near_sdk::PromiseError>,
    ) {
        if !is_promise_success() {
            return;
        }

        let price_1 = price_1.unwrap();
        let price_2 = price_2.unwrap();

        // Do something with the prices.
        log!("{:?}", price_1);
        log!("{:?}", price_2);
    }
}
