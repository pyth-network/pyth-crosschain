#[test_only]
module pyth_lazer::pyth_lazer_tests {
    use std::signer;
    use std::string;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::ed25519;
    use pyth_lazer::pyth_lazer;

    // Test accounts
    const TOP_AUTHORITY: address = @0x123;
    const TREASURY: address = @0x456;
    const USER: address = @0x789;

    // Test data
    const TEST_PUBKEY: vector<u8> = x"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const TEST_MESSAGE: vector<u8> = x"deadbeef";
    const TEST_SIGNATURE: vector<u8> = x"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test_only]
    fun setup_aptos_coin(framework: &signer): coin::MintCapability<AptosCoin> {
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<AptosCoin>(
            framework,
            std::string::utf8(b"Aptos Coin"),
            std::string::utf8(b"APT"),
            8,
            false,
        );
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_freeze_cap(freeze_cap);
        mint_cap
    }

    fun setup(): (signer, signer, signer) {
        // Create test accounts
        let framework = account::create_account_for_test(@aptos_framework);
        let top_authority = account::create_account_for_test(TOP_AUTHORITY);
        let treasury = account::create_account_for_test(TREASURY);
        let user = account::create_account_for_test(USER);
        
        // Setup AptosCoin and get mint capability
        let mint_cap = setup_aptos_coin(&framework);
        
        // Register accounts for AptosCoin
        coin::register<AptosCoin>(&top_authority);
        coin::register<AptosCoin>(&treasury);
        coin::register<AptosCoin>(&user);
        
        // Give user some coins for fees
        let coins = coin::mint<AptosCoin>(1000, &mint_cap);
        coin::deposit(signer::address_of(&user), coins);
        coin::destroy_mint_cap(mint_cap);
        
        // Initialize timestamp for expiration tests
        timestamp::set_time_has_started_for_testing(&framework);
        
        // Initialize contract
        pyth_lazer::initialize(&top_authority, TOP_AUTHORITY, TREASURY);

        (top_authority, treasury, user)
    }

    #[test]
    fun test_initialize() {
        let (top_authority, _treasury, _) = setup();
        // Contract is already initialized in setup
    }

    #[test]
    fun test_update_add_signer() {
        let (top_authority, _treasury, _) = setup();

        // Add signer
        let expires_at = timestamp::now_seconds() + 1000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, expires_at);

        // Update signer
        let new_expires_at = timestamp::now_seconds() + 2000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, new_expires_at);

        // Remove signer
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, 0);
    }

    #[test]
    #[expected_failure(abort_code = pyth_lazer::ENO_SPACE)]
    fun test_max_signers() {
        let (top_authority, _treasury, _) = setup();

        let expires_at = timestamp::now_seconds() + 1000;
        let pubkey1 = x"1111111111111111111111111111111111111111111111111111111111111111";
        let pubkey2 = x"2222222222222222222222222222222222222222222222222222222222222222";
        let pubkey3 = x"3333333333333333333333333333333333333333333333333333333333333333";

        pyth_lazer::update_trusted_signer(&top_authority, pubkey1, expires_at);
        pyth_lazer::update_trusted_signer(&top_authority, pubkey2, expires_at);
        // This should fail as we already have 2 signers
        pyth_lazer::update_trusted_signer(&top_authority, pubkey3, expires_at);
    }

    #[test]
    #[expected_failure(abort_code = pyth_lazer::EINVALID_SIGNER)]
    fun test_expired_signer() {
        let (top_authority, _treasury, user) = setup();

        // Add signer that expires in 1000 seconds
        let expires_at = timestamp::now_seconds() + 1000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, expires_at);

        // Move time forward past expiration
        timestamp::fast_forward_seconds(2000);

        // This should fail as the signer is expired
        pyth_lazer::verify_message(&user, TEST_MESSAGE, TEST_SIGNATURE, TEST_PUBKEY);
    }

    #[test]
    #[expected_failure(abort_code = pyth_lazer::EINSUFFICIENT_FEE)]
    fun test_insufficient_fee() {
        let (top_authority, _treasury, user) = setup();

        // Drain user's balance
        let user_balance = coin::balance<AptosCoin>(signer::address_of(&user));
        coin::transfer<AptosCoin>(&user, TREASURY, user_balance);

        // This should fail due to insufficient fee
        pyth_lazer::verify_message(&user, TEST_MESSAGE, TEST_SIGNATURE, TEST_PUBKEY);
    }
}
