#[test_only]
module pyth_lazer::pyth_lazer_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::ed25519;
    use pyth_lazer::pyth_lazer::{
        Self,
        EINVALID_SIGNER,
        EINSUFFICIENT_FEE,
        EINVALID_SIGNATURE
    };

    // Test accounts
    const TOP_AUTHORITY: address =
        @0x3374049c3b46a907ff2fc6b62af51975fb9dc572b7e73eb1b255ed5edcd7cee0;
    const TREASURY: address = @0x456;
    const USER: address = @0x789;

    // Test data
    const TEST_PUBKEY: vector<u8> = x"3374049c3b46a907ff2fc6b62af51975fb9dc572b7e73eb1b255ed5edcd7cee0";
    const TEST_MESSAGE: vector<u8> = b"test message";
    const TEST_SIGNATURE: vector<u8> = x"20ebb15d70abc18abf636d77fa86a89e32596f90569b09e732b556bbc2f8afea07feff8d1beb18f7acd7ef1d3f914163fe03a3b4206f61f932e2d22a21278a01";

    #[test_only]
    fun setup_aptos_coin(framework: &signer): coin::MintCapability<AptosCoin> {
        let (burn_cap, freeze_cap, mint_cap) =
            coin::initialize<AptosCoin>(
                framework,
                std::string::utf8(b"Aptos Coin"),
                std::string::utf8(b"APT"),
                8,
                false
            );
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_freeze_cap(freeze_cap);
        mint_cap
    }

    fun setup(): (signer, signer, signer) {
        // Create test accounts
        let framework = account::create_account_for_test(@aptos_framework);
        let lazer_contract = account::create_account_for_test(@pyth_lazer);
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
        pyth_lazer::initialize(&lazer_contract, TOP_AUTHORITY, TREASURY);

        (top_authority, treasury, user)
    }

    #[test]
    fun test_verify_valid_message_succeeds() {
        let (top_authority, _treasury, user) = setup();

        // Add a valid signer
        let expires_at = timestamp::now_seconds() + 1000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, expires_at);

        // Create a valid ed25519 signature
        let signature = ed25519::new_signature_from_bytes(TEST_SIGNATURE);
        let pubkey = ed25519::new_unvalidated_public_key_from_bytes(TEST_PUBKEY);
        assert!(
            ed25519::signature_verify_strict(&signature, &pubkey, TEST_MESSAGE),
            0
        );

        // This should succeed as we have a valid signer and sufficient fee
        pyth_lazer::verify_message(
            &user,
            TEST_MESSAGE,
            TEST_SIGNATURE,
            TEST_PUBKEY
        );
    }

    #[test]
    #[expected_failure(abort_code = EINVALID_SIGNATURE)]
    fun test_verify_invalid_message_fails() {
        let (top_authority, _treasury, user) = setup();

        // Add a valid signer
        let expires_at = timestamp::now_seconds() + 1000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, expires_at);

        // Use a different message than what was signed
        let invalid_message = b"different message";

        // This should fail with EINVALID_SIGNATURE since the signature
        // was created for TEST_MESSAGE, not invalid_message
        pyth_lazer::verify_message(
            &user,
            invalid_message,
            TEST_SIGNATURE,
            TEST_PUBKEY
        );
    }

    #[test]
    fun test_add_update_remove_signers_succeeds() {
        let (top_authority, _treasury, _) = setup();

        // Add multiple signers
        let expires_at = timestamp::now_seconds() + 1000;
        let pubkey1 = x"1111111111111111111111111111111111111111111111111111111111111111";
        let pubkey2 = x"2222222222222222222222222222222222222222222222222222222222222222";
        let pubkey3 = x"3333333333333333333333333333333333333333333333333333333333333333";

        pyth_lazer::update_trusted_signer(&top_authority, pubkey1, expires_at);
        pyth_lazer::update_trusted_signer(&top_authority, pubkey2, expires_at);
        pyth_lazer::update_trusted_signer(&top_authority, pubkey3, expires_at);

        // Verify signers were added
        let trusted_signers = pyth_lazer::get_trusted_signers();
        assert!(vector::length(&trusted_signers) == 3, 0);

        // Verify first signer
        let signer_info = vector::borrow(&trusted_signers, 0);
        let signer_pubkey = pyth_lazer::get_signer_pubkey(signer_info);
        let signer_expires_at = pyth_lazer::get_signer_expires_at(signer_info);
        assert!(signer_pubkey == pubkey1, 0);
        assert!(signer_expires_at == expires_at, 0);

        // Update second signer
        let new_expires_at = timestamp::now_seconds() + 2000;
        pyth_lazer::update_trusted_signer(&top_authority, pubkey2, new_expires_at);

        // Verify second signer was updated
        let trusted_signers = pyth_lazer::get_trusted_signers();
        let signer_info = vector::borrow(&trusted_signers, 1);
        let signer_pubkey = pyth_lazer::get_signer_pubkey(signer_info);
        let signer_expires_at = pyth_lazer::get_signer_expires_at(signer_info);
        assert!(signer_pubkey == pubkey2, 0);
        assert!(signer_expires_at == new_expires_at, 0);

        // Remove all signers
        pyth_lazer::update_trusted_signer(&top_authority, pubkey1, 0);
        pyth_lazer::update_trusted_signer(&top_authority, pubkey2, 0);
        pyth_lazer::update_trusted_signer(&top_authority, pubkey3, 0);

        // Verify all signers were removed
        let trusted_signers = pyth_lazer::get_trusted_signers();
        assert!(vector::length(&trusted_signers) == 0, 0);
    }

    #[test]
    #[expected_failure(abort_code = EINVALID_SIGNER)]
    fun test_expired_signer_throws_error() {
        let (top_authority, _treasury, user) = setup();

        // Add signer that expires in 1000 seconds
        let expires_at = timestamp::now_seconds() + 1000;
        pyth_lazer::update_trusted_signer(&top_authority, TEST_PUBKEY, expires_at);

        // Move time forward past expiration
        timestamp::fast_forward_seconds(2000);

        // This should fail as the signer is expired
        pyth_lazer::verify_message(
            &user,
            TEST_MESSAGE,
            TEST_SIGNATURE,
            TEST_PUBKEY
        );
    }

    #[test]
    #[expected_failure(abort_code = EINSUFFICIENT_FEE)]
    fun test_insufficient_fee_throws_error() {
        let (_top_authority, _treasury, user) = setup();

        // Drain user's balance
        let user_balance = coin::balance<AptosCoin>(signer::address_of(&user));
        coin::transfer<AptosCoin>(&user, TREASURY, user_balance);

        // This should fail due to insufficient fee
        pyth_lazer::verify_message(
            &user,
            TEST_MESSAGE,
            TEST_SIGNATURE,
            TEST_PUBKEY
        );
    }
}
