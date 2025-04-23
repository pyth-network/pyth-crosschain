pub use pythnet_sdk::messages::{FeedId, PriceFeedMessage};
use {
    crate::{check, error::GetPriceError},
    anchor_lang::prelude::{borsh::BorshSchema, *},
    solana_program::pubkey::Pubkey,
};

/// Pyth price updates are bridged to all blockchains via Wormhole.
/// Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.
/// The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,
/// so we also allow for partial verification.
///
/// This enum represents how much a price update has been verified:
/// - If `Full`, we have verified the signatures for two thirds of the current guardians.
/// - If `Partial`, only `num_signatures` guardian signatures have been checked.
///
/// # Warning
/// Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update.
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, BorshSchema, Debug)]
pub enum VerificationLevel {
    Partial {
        #[allow(unused)]
        num_signatures: u8,
    },
    Full,
}

impl VerificationLevel {
    /// Compare two `VerificationLevel`.
    /// `Full` is always greater than `Partial`, and `Partial` with more signatures is greater than `Partial` with fewer signatures.
    pub fn gte(&self, other: VerificationLevel) -> bool {
        match self {
            VerificationLevel::Full => true,
            VerificationLevel::Partial { num_signatures } => match other {
                VerificationLevel::Full => false,
                VerificationLevel::Partial {
                    num_signatures: other_num_signatures,
                } => *num_signatures >= other_num_signatures,
            },
        }
    }
}

/// A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.
/// It contains:
/// - `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.
/// - `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.
/// - `price_message`: The actual price update.
/// - `posted_slot`: The slot at which this price update was posted.
#[account]
#[derive(BorshSchema)]
pub struct PriceUpdateV2 {
    pub write_authority: Pubkey,
    pub verification_level: VerificationLevel,
    pub price_message: PriceFeedMessage,
    pub posted_slot: u64,
}

impl PriceUpdateV2 {
    pub const LEN: usize = 8 + 32 + 2 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8 + 8;
}
/// A time weighted average price account.
/// This account is used by the Pyth Receiver program to store a TWAP update from a Pyth price feed.
/// TwapUpdates can only be created after the client has verified the VAAs via the Wormhole contract.
/// Check out `target_chains/solana/cli/src/main.rs` for an example of how to do this.
///
/// It contains:
/// - `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different TWAP update.
/// - `twap`: The actual TWAP update.
#[account]
#[derive(BorshSchema)]
pub struct TwapUpdate {
    pub write_authority: Pubkey,
    pub twap: TwapPrice,
}

impl TwapUpdate {
    pub const LEN: usize = (
        8 // account discriminator (anchor)
        + 32 // write_authority
        + (32 + 8 + 8 + 8 + 8 + 4 + 4)
        // twap
    );

    /// Get a `TwapPrice` from a `TwapUpdate` account for a given `FeedId`.
    ///
    /// # Warning
    /// This function does not check :
    /// - How recent the price is
    /// - If the TWAP's window size is expected
    /// - Whether the price update has been verified
    ///
    /// It is therefore unsafe to use this function without any extra checks,
    /// as it allows for the possibility of using unverified, outdated, or arbitrary window length twap updates.
    pub fn get_twap_unchecked(
        &self,
        feed_id: &FeedId,
    ) -> std::result::Result<TwapPrice, GetPriceError> {
        check!(
            self.twap.feed_id == *feed_id,
            GetPriceError::MismatchedFeedId
        );
        Ok(self.twap)
    }
    /// Get a `TwapPrice` from a `TwapUpdate` account for a given `FeedId` no older than `maximum_age` with a specific window size.
    ///
    /// # Example
    /// ```
    /// use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, TwapUpdate};
    /// use anchor_lang::prelude::*;
    ///
    /// const MAXIMUM_AGE: u64 = 30;
    /// const WINDOW_SECONDS: u64 = 300; // 5-minute TWAP
    /// const FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"; // SOL/USD
    ///
    /// #[derive(Accounts)]
    /// pub struct ReadTwapAccount<'info> {
    ///     pub twap_update: Account<'info, TwapUpdate>,
    /// }
    ///
    /// pub fn read_twap_account(ctx: Context<ReadTwapAccount>) -> Result<()> {
    ///     let twap_update = &ctx.accounts.twap_update;
    ///     let twap = twap_update.get_twap_no_older_than(
    ///         &Clock::get()?,
    ///         MAXIMUM_AGE,
    ///         WINDOW_SECONDS,
    ///         &get_feed_id_from_hex(FEED_ID)?
    ///     )?;
    ///     Ok(())
    /// }
    /// ```
    pub fn get_twap_no_older_than(
        &self,
        clock: &Clock,
        maximum_age: u64,
        window_seconds: u64,
        feed_id: &FeedId,
    ) -> std::result::Result<TwapPrice, GetPriceError> {
        // Ensure the update isn't outdated
        let twap_price = self.get_twap_unchecked(feed_id)?;
        check!(
            twap_price
                .end_time
                .saturating_add(maximum_age.try_into().unwrap())
                >= clock.unix_timestamp,
            GetPriceError::PriceTooOld
        );

        // Ensure the twap window size is as expected
        let actual_window = twap_price.end_time.saturating_sub(twap_price.start_time);
        check!(
            actual_window == i64::try_from(window_seconds).unwrap(),
            GetPriceError::InvalidWindowSize
        );

        Ok(twap_price)
    }
}
/// The time weighted average price & conf for a feed over the window [start_time, end_time].
/// This type is used to persist the calculated TWAP in TwapUpdate accounts on Solana.
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, BorshSchema, Debug)]
pub struct TwapPrice {
    /// `FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature.
    pub feed_id: [u8; 32],
    pub start_time: i64,
    pub end_time: i64,
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    /// Ratio out of 1_000_000, where a value of 1_000_000 represents
    /// all slots were missed and 0 represents no slots were missed.
    pub down_slots_ratio: u32,
}

/// A Pyth price.
/// The actual price is `(price ± conf)* 10^exponent`. `publish_time` may be used to check the recency of the price.
#[derive(PartialEq, Debug, Clone, Copy)]
pub struct Price {
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
}

impl PriceUpdateV2 {
    /// Get a `Price` from a `PriceUpdateV2` account for a given `FeedId`.
    ///
    /// # Warning
    /// This function does not check :
    /// - How recent the price is
    /// - Whether the price update has been verified
    ///
    /// It is therefore unsafe to use this function without any extra checks, as it allows for the possibility of using unverified or outdated price updates.
    pub fn get_price_unchecked(
        &self,
        feed_id: &FeedId,
    ) -> std::result::Result<Price, GetPriceError> {
        check!(
            self.price_message.feed_id == *feed_id,
            GetPriceError::MismatchedFeedId
        );
        Ok(Price {
            price: self.price_message.price,
            conf: self.price_message.conf,
            exponent: self.price_message.exponent,
            publish_time: self.price_message.publish_time,
        })
    }

    /// Get a `Price` from a `PriceUpdateV2` account for a given `FeedId` no older than `maximum_age` with customizable verification level.
    ///
    /// # Warning
    /// Lowering the verification level from `Full` to `Partial` increases the risk of using a malicious price update.
    /// Please read the documentation for [`VerificationLevel`] for more information.
    ///
    /// # Example
    /// ```
    /// use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, VerificationLevel, PriceUpdateV2};
    /// use anchor_lang::prelude::*;
    ///
    /// const MAXIMUM_AGE : u64 = 30;
    /// const FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"; // SOL/USD
    ///
    /// #[derive(Accounts)]
    /// #[instruction(amount_in_usd : u64)]
    /// pub struct ReadPriceAccount<'info> {
    ///     pub price_update: Account<'info, PriceUpdateV2>,
    /// }
    ///
    /// pub fn read_price_account(ctx : Context<ReadPriceAccount>) -> Result<()> {
    ///     let price_update = &mut ctx.accounts.price_update;
    ///     let price = price_update.get_price_no_older_than_with_custom_verification_level(&Clock::get()?, MAXIMUM_AGE, &get_feed_id_from_hex(FEED_ID)?, VerificationLevel::Partial{num_signatures: 5})?;
    ///     Ok(())
    /// }
    ///```
    pub fn get_price_no_older_than_with_custom_verification_level(
        &self,
        clock: &Clock,
        maximum_age: u64,
        feed_id: &FeedId,
        verification_level: VerificationLevel,
    ) -> std::result::Result<Price, GetPriceError> {
        check!(
            self.verification_level.gte(verification_level),
            GetPriceError::InsufficientVerificationLevel
        );
        let price = self.get_price_unchecked(feed_id)?;
        check!(
            price
                .publish_time
                .saturating_add(maximum_age.try_into().unwrap())
                >= clock.unix_timestamp,
            GetPriceError::PriceTooOld
        );
        Ok(price)
    }

    /// Get a `Price` from a `PriceUpdateV2` account for a given `FeedId` no older than `maximum_age` with `Full` verification.
    ///
    /// # Example
    /// ```
    /// use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
    /// use anchor_lang::prelude::*;
    ///
    /// const MAXIMUM_AGE : u64 = 30;
    /// const FEED_ID: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"; // SOL/USD
    ///
    /// #[derive(Accounts)]
    /// #[instruction(amount_in_usd : u64)]
    /// pub struct ReadPriceAccount<'info> {
    ///     pub price_update: Account<'info, PriceUpdateV2>,
    /// }
    ///
    /// pub fn read_price_account(ctx : Context<ReadPriceAccount>) -> Result<()> {
    ///     let price_update = &mut ctx.accounts.price_update;
    ///     let price = price_update.get_price_no_older_than(&Clock::get()?, MAXIMUM_AGE, &get_feed_id_from_hex(FEED_ID)?)?;
    ///     Ok(())
    /// }
    ///```
    pub fn get_price_no_older_than(
        &self,
        clock: &Clock,
        maximum_age: u64,
        feed_id: &FeedId,
    ) -> std::result::Result<Price, GetPriceError> {
        self.get_price_no_older_than_with_custom_verification_level(
            clock,
            maximum_age,
            feed_id,
            VerificationLevel::Full,
        )
    }
}

/// Get a `FeedId` from a hex string.
///
/// Price feed ids are a 32 byte unique identifier for each price feed in the Pyth network.
/// They are sometimes represented as a 64 character hex string (with or without a 0x prefix).
///
/// # Example
///
/// ```
/// use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;
/// let feed_id = get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d").unwrap();
/// ```
pub fn get_feed_id_from_hex(input: &str) -> std::result::Result<FeedId, GetPriceError> {
    let mut feed_id: FeedId = [0; 32];
    match input.len() {
        66 => feed_id.copy_from_slice(
            &hex::decode(&input[2..]).map_err(|_| GetPriceError::FeedIdNonHexCharacter)?,
        ),
        64 => feed_id.copy_from_slice(
            &hex::decode(input).map_err(|_| GetPriceError::FeedIdNonHexCharacter)?,
        ),
        _ => return Err(GetPriceError::FeedIdMustBe32Bytes),
    }
    Ok(feed_id)
}

#[cfg(test)]
pub mod tests {
    use {
        crate::{
            error::GetPriceError,
            price_update::{Price, PriceUpdateV2, TwapPrice, TwapUpdate, VerificationLevel},
        },
        anchor_lang::Discriminator,
        pythnet_sdk::messages::PriceFeedMessage,
        solana_program::{borsh0_10, clock::Clock, pubkey::Pubkey},
    };

    #[test]
    fn check_size() {
        assert!(
            PriceUpdateV2::discriminator().len() + borsh0_10::get_packed_len::<PriceUpdateV2>()
                == PriceUpdateV2::LEN
        );
    }

    #[test]
    fn gte() {
        assert!(VerificationLevel::Full.gte(VerificationLevel::Full));
        assert!(VerificationLevel::Full.gte(VerificationLevel::Partial {
            num_signatures: 255,
        }));
        assert!(VerificationLevel::Partial { num_signatures: 8 }
            .gte(VerificationLevel::Partial { num_signatures: 8 }));
        assert!(!VerificationLevel::Partial { num_signatures: 8 }.gte(VerificationLevel::Full));
        assert!(!VerificationLevel::Partial { num_signatures: 8 }
            .gte(VerificationLevel::Partial { num_signatures: 9 }));
    }

    #[test]
    fn get_feed_id_from_hex() {
        let feed_id = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
        let expected_feed_id = [
            239, 13, 139, 111, 218, 44, 235, 164, 29, 161, 93, 64, 149, 209, 218, 57, 42, 13, 47,
            142, 208, 198, 199, 188, 15, 76, 250, 200, 194, 128, 181, 109,
        ];
        assert_eq!(super::get_feed_id_from_hex(feed_id), Ok(expected_feed_id));
        assert_eq!(
            super::get_feed_id_from_hex(&feed_id[2..]),
            Ok(expected_feed_id)
        );

        assert_eq!(
            super::get_feed_id_from_hex(&feed_id[..64]),
            Err(GetPriceError::FeedIdNonHexCharacter)
        );

        assert_eq!(
            super::get_feed_id_from_hex(
                "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b5"
            ),
            Err(GetPriceError::FeedIdMustBe32Bytes)
        );
    }

    #[test]
    fn get_price() {
        let expected_price = Price {
            price: 1,
            conf: 2,
            exponent: 3,
            publish_time: 900,
        };

        let feed_id = [0; 32];
        let mismatched_feed_id = [1; 32];
        let mock_clock = Clock {
            unix_timestamp: 1000,
            ..Default::default()
        };

        let price_update_unverified = PriceUpdateV2 {
            write_authority: Pubkey::new_unique(),
            verification_level: VerificationLevel::Partial { num_signatures: 0 },
            price_message: PriceFeedMessage {
                feed_id,
                ema_conf: 0,
                ema_price: 0,
                price: 1,
                conf: 2,
                exponent: 3,
                prev_publish_time: 899,
                publish_time: 900,
            },
            posted_slot: 0,
        };

        let price_update_partially_verified = PriceUpdateV2 {
            write_authority: Pubkey::new_unique(),
            verification_level: VerificationLevel::Partial { num_signatures: 5 },
            price_message: PriceFeedMessage {
                feed_id,
                ema_conf: 0,
                ema_price: 0,
                price: 1,
                conf: 2,
                exponent: 3,
                prev_publish_time: 899,
                publish_time: 900,
            },
            posted_slot: 0,
        };

        let price_update_fully_verified = PriceUpdateV2 {
            write_authority: Pubkey::new_unique(),
            verification_level: VerificationLevel::Full,
            price_message: PriceFeedMessage {
                feed_id,
                ema_conf: 0,
                ema_price: 0,
                price: 1,
                conf: 2,
                exponent: 3,
                prev_publish_time: 899,
                publish_time: 900,
            },
            posted_slot: 0,
        };

        assert_eq!(
            price_update_unverified.get_price_unchecked(&feed_id),
            Ok(expected_price)
        );
        assert_eq!(
            price_update_partially_verified.get_price_unchecked(&feed_id),
            Ok(expected_price)
        );
        assert_eq!(
            price_update_fully_verified.get_price_unchecked(&feed_id),
            Ok(expected_price)
        );

        assert_eq!(
            price_update_unverified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                100,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_partially_verified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                100,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Ok(expected_price)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                100,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Ok(expected_price)
        );

        assert_eq!(
            price_update_unverified.get_price_no_older_than(&mock_clock, 100, &feed_id,),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_partially_verified.get_price_no_older_than(&mock_clock, 100, &feed_id,),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than(&mock_clock, 100, &feed_id,),
            Ok(expected_price)
        );

        // Reduce maximum_age
        assert_eq!(
            price_update_unverified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                10,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_partially_verified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                10,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Err(GetPriceError::PriceTooOld)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                10,
                &feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Err(GetPriceError::PriceTooOld)
        );

        assert_eq!(
            price_update_unverified.get_price_no_older_than(&mock_clock, 10, &feed_id,),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_partially_verified.get_price_no_older_than(&mock_clock, 10, &feed_id,),
            Err(GetPriceError::InsufficientVerificationLevel)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than(&mock_clock, 10, &feed_id,),
            Err(GetPriceError::PriceTooOld)
        );

        // Mismatched feed id
        assert_eq!(
            price_update_fully_verified.get_price_unchecked(&mismatched_feed_id),
            Err(GetPriceError::MismatchedFeedId)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than_with_custom_verification_level(
                &mock_clock,
                100,
                &mismatched_feed_id,
                VerificationLevel::Partial { num_signatures: 5 }
            ),
            Err(GetPriceError::MismatchedFeedId)
        );
        assert_eq!(
            price_update_fully_verified.get_price_no_older_than(
                &mock_clock,
                100,
                &mismatched_feed_id,
            ),
            Err(GetPriceError::MismatchedFeedId)
        );
    }
    #[test]
    fn test_get_twap_no_older_than() {
        let expected_twap = TwapPrice {
            feed_id: [0; 32],
            start_time: 800,
            end_time: 900, // Window size is 100 seconds (900 - 800)
            price: 1,
            conf: 2,
            exponent: -3,
            down_slots_ratio: 0,
        };

        let feed_id = [0; 32];
        let mismatched_feed_id = [1; 32];
        let mock_clock = Clock {
            unix_timestamp: 1000,
            ..Default::default()
        };

        let update = TwapUpdate {
            write_authority: Pubkey::new_unique(),
            twap: expected_twap,
        };

        // Test unchecked access
        assert_eq!(update.get_twap_unchecked(&feed_id), Ok(expected_twap));

        // Test with correct window size (100 seconds)
        assert_eq!(
            update.get_twap_no_older_than(&mock_clock, 100, 100, &feed_id),
            Ok(expected_twap)
        );

        // Test with incorrect window size
        assert_eq!(
            update.get_twap_no_older_than(&mock_clock, 100, 101, &feed_id),
            Err(GetPriceError::InvalidWindowSize)
        );

        // Test with incorrect window size
        assert_eq!(
            update.get_twap_no_older_than(&mock_clock, 100, 99, &feed_id),
            Err(GetPriceError::InvalidWindowSize)
        );

        // Test with reduced maximum age
        assert_eq!(
            update.get_twap_no_older_than(&mock_clock, 10, 100, &feed_id),
            Err(GetPriceError::PriceTooOld)
        );

        // Test with mismatched feed id
        assert_eq!(
            update.get_twap_unchecked(&mismatched_feed_id),
            Err(GetPriceError::MismatchedFeedId)
        );
        assert_eq!(
            update.get_twap_no_older_than(&mock_clock, 100, 100, &mismatched_feed_id),
            Err(GetPriceError::MismatchedFeedId)
        );
    }
}
