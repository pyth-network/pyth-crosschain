#[cfg(test)]
#[allow(clippy::module_inception)]
mod tests {
    use {
        crate::{state::Source, Pyth},
        near_sdk::{test_utils::VMContextBuilder, testing_env, VMContext},
    };

    fn create_contract() -> Pyth {
        Pyth::new(
            "wormhole.near".parse().unwrap(),
            Source::default(),
            Source::default(),
            1.into(),
            32,
        )
    }

    fn get_context() -> VMContext {
        VMContextBuilder::new()
            .signer_account_id("pda".parse().unwrap())
            .is_view(false)
            .build()
    }

    #[test]
    fn test_contract_init() {
        let contract = create_contract();
        let context = get_context();
        testing_env!(context);
        assert_eq!(contract.sources.len(), 1);
        assert_eq!(contract.prices.len(), 0);
    }
}
