module mint_nft::minting {
    use std::signer;
    use std::string::{Self, String};
    use std::vector;

    use aptos_framework::account;
    use aptos_framework::event::EventHandle;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin;

    use pyth::pyth;
    use pyth::price_identifier;
    use pyth::i64;
    use pyth::price;

    use aptos_std::math64::pow;

    use aptos_token::token::{Self, TokenDataId};

    const APTOS_USD_PRICE_FEED_IDENTIFIER : vector<u8> = x"ca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6"; // This is actually the ETH/USD while APT is not listed

    // This event stores the receiver of the NFT and the TokenDataId of the NFT
    struct TokenMintingEvent has drop, store {
        token_receiver_address: address,
        token_data_id: TokenDataId,
    }

    // This struct stores an NFT relevant information and the signer capability required to mint the NFT
    struct CollectionTokenMinter has key {
        token_data_id: TokenDataId,
        token_minting_events: EventHandle<TokenMintingEvent>,
        signer_cap: account::SignerCapability
    }

    /// Octas per aptos coin
    const OCTAS_PER_APTOS: u64 = 100000000;

    /// Initialize this module: create a resource account, a collection, and a token data id, all the NFTs minted are editions of the same TokenDataId
    fun init_module(resource_account: &signer) {
        let collection_name = string::utf8(b"Pythians");
        let description = string::utf8(b"Pythians");
        let collection_uri = string::utf8(b"https://pyth.network/");
        let token_name = string::utf8(b"Pythian by @EgorNaive");
        let token_uri = string::utf8(b"https://pbs.twimg.com/media/FeVw9JPWYAAsiI6?format=jpg&name=medium");

        // Create the resource account that we'll use to create tokens
        let (resource_signer, resource_signer_cap) = account::create_resource_account(resource_account, b"hello");

        // Create the nft collection
        let maximum_supply = 1; // There's only 1 NFT in the collection
        let mutate_setting = vector<bool>[ false, false, false ];
        let resource_account_address = signer::address_of(&resource_signer);
        token::create_collection(&resource_signer, collection_name, description, collection_uri, maximum_supply, mutate_setting);

        // Create a token data id to specify which token will be minted
        let token_data_id = token::create_tokendata(
            &resource_signer,
            collection_name,
            token_name,
            string::utf8(b""),
            0, // 0 means the supply is infinite
            token_uri,
            resource_account_address,
            0,
            0,
            // We don't allow any mutation to the token
            token::create_token_mutability_config(
                &vector<bool>[ false, false, false, false, true ]
            ),
            vector::empty<String>(),
            vector::empty<vector<u8>>(),
            vector::empty<String>(),
        );

        move_to(resource_account, CollectionTokenMinter {
            token_data_id,
            token_minting_events: account::new_event_handle<TokenMintingEvent>(resource_account),
            signer_cap : resource_signer_cap
        });
    }

    /// Mint an edition of the Pythian NFT pay 100 USD in native APT
    public entry fun mint_nft(receiver : &signer, vaa : vector<vector<u8>>) acquires CollectionTokenMinter{
        // Fetch the signer capability to mint the NFT
        let collection_token_minter = borrow_global_mut<CollectionTokenMinter>(@mint_nft); 
        let resource_signer = account::create_signer_with_capability(&collection_token_minter.signer_cap);

        let token_id = token::mint_token(&resource_signer, collection_token_minter.token_data_id, 1); // Mint the NFT
        token::direct_transfer(&resource_signer, receiver, token_id, 1); // Transfer the NFT to the caller

        let coins = coin::withdraw<aptos_coin::AptosCoin>(receiver, pyth::get_update_fee()); // Get coins to pay for the update
        pyth::update_price_feeds(vaa, coins); // Update price feed with the provided VAA

        let price = pyth::get_price(price_identifier::from_byte_vec(APTOS_USD_PRICE_FEED_IDENTIFIER)); // Get recent price (will fail if price is too old)     
        let price_positive = i64::get_magnitude_if_positive(&price::get_price(&price)); // This will fail if the price is negative
        let expo_magnitude = i64::get_magnitude_if_negative(&price::get_expo(&price)); // This will fail if the exponent is positive

        let price_in_aptos_coin =  (100 * OCTAS_PER_APTOS * pow(10, expo_magnitude)) / price_positive; // 100 USD in AptosCoin

        coin::transfer<aptos_coin::AptosCoin>(receiver, @mint_nft, price_in_aptos_coin); // Pay for the NFT
    }
}
