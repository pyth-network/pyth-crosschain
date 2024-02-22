use {
    crate::{
        check,
        error::GetPriceError,
    },
    anchor_lang::prelude::{
        borsh::BorshSchema,
        *,
    },
    pythnet_sdk::messages::{
        FeedId,
        PriceFeedMessage,
    },
    solana_program::pubkey::Pubkey,
};


/**
 * This enum represents how many guardian signatures were checked for a Pythnet price update
 * If full, guardian quorum has been attained
 * If partial, at least config.minimum signatures have been verified, but in the case config.minimum_signatures changes in the future we also include the number of signatures that were checked
 */
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, PartialEq, BorshSchema, Debug)]
pub enum VerificationLevel {
    Partial { num_signatures: u8 },
    Full,
}

impl VerificationLevel {
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

#[account]
#[derive(BorshSchema)]
pub struct PriceUpdateV1 {
    pub write_authority:    Pubkey, // This write authority can close this account
    pub verification_level: VerificationLevel, // Whether all the guardian signatures have been checked, and if not, how many have been checked
    pub price_message:      PriceFeedMessage,
}

impl PriceUpdateV1 {
    pub const LEN: usize = 8 + 32 + 2 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
}

pub struct Price {
    pub price:        i64,
    pub conf:         u64,
    pub exponent:     i32,
    pub publish_time: i64,
}

impl PriceUpdateV1 {
    pub fn get_price_unchecked(
        &self,
        feed_id: &FeedId,
    ) -> std::result::Result<Price, GetPriceError> {
        check!(
            self.price_message.feed_id == *feed_id,
            GetPriceError::MismatchedFeedId
        );
        Ok(Price {
            price:        self.price_message.price,
            conf:         self.price_message.conf,
            exponent:     self.price_message.exponent,
            publish_time: self.price_message.publish_time,
        })
    }

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

/**
 * This function takes a hex string and returns a FeedId
 * The hex string should be 66 characters long, and should start with "0x"
 */
pub fn get_feed_id_from_hex(input: &str) -> std::result::Result<FeedId, GetPriceError> {
    if input.len() != 66 {
        return Err(GetPriceError::FeedIdMustBe32Bytes);
    }
    let mut feed_id: FeedId = [0; 32];
    feed_id.copy_from_slice(&hex::decode(&input[2..]).unwrap());
    Ok(feed_id)
}

#[cfg(test)]
pub mod tests {
    use {
        crate::price_update::{
            PriceUpdateV1,
            VerificationLevel,
        },
        anchor_lang::Discriminator,
        solana_program::borsh0_10,
    };

    #[test]
    fn check_size() {
        assert!(
            PriceUpdateV1::discriminator().len() + borsh0_10::get_packed_len::<PriceUpdateV1>()
                == PriceUpdateV1::LEN
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
}
