use ethers::types::U256;
use pyth_sdk::PriceIdentifier;

pub type PriceId = PriceIdentifier;
pub type SubscriptionId = U256;

use crate::adapters::ethereum::pyth_pulse::Price as ContractPrice; // ABI-generated Price
use pyth_sdk::Price as SdkPrice; // pyth_sdk::Price

impl From<ContractPrice> for SdkPrice {
    fn from(contract_price: ContractPrice) -> Self {
        SdkPrice {
            price: contract_price.price,
            conf: contract_price.conf,
            expo: contract_price.expo,
            publish_time: contract_price
                .publish_time
                .try_into()
                .expect("Failed to convert publish_time from U256 to i64 (UnixTimestamp)"),
        }
    }
}
