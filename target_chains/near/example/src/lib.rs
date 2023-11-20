use {
    near_sdk::{
        borsh::{
            self,
            BorshDeserialize,
            BorshSerialize,
        },
        env,
        is_promise_success,
        near_bindgen,
        AccountId,
        Gas,
        PanicOnDefault,
        Promise,
        PromiseError,
    },
    pyth::state::PriceIdentifier,
};

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

    /// Get a Pyth Price Feed Result.
    #[payable]
    pub fn example_price_usage(&mut self, identifier: PriceIdentifier, data: String) -> Promise {
        pyth::ext::ext_pyth::ext(self.pyth.clone())
            .with_static_gas(Gas(30_000_000_000_000))
            .with_attached_deposit(env::attached_deposit())
            .update_price_feeds(data)
            .then(
                pyth::ext::ext_pyth::ext(self.pyth.clone())
                    .get_price(identifier)
                    .then(
                        Self::ext(env::current_account_id())
                            .with_static_gas(Gas(10_000_000_000))
                            .handle_example_price_usage(),
                    ),
            )
    }

    #[payable]
    #[private]
    #[handle_result]
    pub fn handle_example_price_usage(
        &mut self,
        #[callback_result] _r: Result<Option<pyth::state::Price>, PromiseError>,
    ) {
        if !is_promise_success() {
            return;
        }

        // Do things with Price Feed Result.
    }
}
