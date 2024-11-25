use alloy_sol_types::sol;
use stylus_sdk::{call::MethodError, prelude::*};

sol! {
    // Function arguments are invalid (e.g., the arguments lengths mismatch)
    // Signature: 0xa9cb9e0d
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidArgument();

    // Update data is coming from an invalid data source.
    // Signature: 0xe60dce71
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidUpdateDataSource();

    // Update data is invalid (e.g., deserialization error)
    // Signature: 0xe69ffece
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidUpdateData();

    // Insufficient fee is paid to the method.
    // Signature: 0x025dbdd4
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InsufficientFee();

    // There is no fresh update, whereas expected fresh updates.
    // Signature: 0xde2c57fa
    #[derive(Debug)]
    #[allow(missing_docs)]
    error NoFreshUpdate();

    // There is no price feed found within the given range or it does not exists.
    // Signature: 0x45805f5d
    #[derive(Debug)]
    #[allow(missing_docs)]
    error PriceFeedNotFoundWithinRange();

    // Price feed not found or it is not pushed on-chain yet.
    // Signature: 0x14aebe68
    #[derive(Debug)]
    #[allow(missing_docs)]
    error PriceFeedNotFound();

    // Requested price is stale.
    // Signature: 0x19abf40e
    #[derive(Debug)]
    #[allow(missing_docs)]
    error StalePrice();

    // Given message is not a valid Wormhole VAA.
    // Signature: 0x2acbe915
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidWormholeVaa();

    // Governance message is invalid (e.g., deserialization error).
    // Signature: 0x97363b35
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidGovernanceMessage();

    // Governance message is not for this contract.
    // Signature: 0x63daeb77
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidGovernanceTarget();

    // Governance message is coming from an invalid data source.
    // Signature: 0x360f2d87
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidGovernanceDataSource();

    // Governance message is old.
    // Signature: 0x88d1b847
    #[derive(Debug)]
    #[allow(missing_docs)]
    error OldGovernanceMessage();

    // The wormhole address to set in SetWormholeAddress governance is invalid.
    // Signature: 0x13d3ed82
    #[derive(Debug)]
    #[allow(missing_docs)]
    error InvalidWormholeAddressToSet();

    #[derive(Debug)]
    #[allow(missing_docs)]
    error FalledDecodeData();


}

/// A Pausable error.
#[derive(SolidityError, Debug)]
pub enum Error {
    InvalidArgument(InvalidArgument),
    InvalidUpdateDataSource(InvalidUpdateDataSource),
    InvalidUpdateData(InvalidUpdateData),
    InsufficientFee(InsufficientFee),
    NoFreshUpdate(NoFreshUpdate),
    PriceFeedNotFoundWithinRange(PriceFeedNotFoundWithinRange),
    PriceFeedNotFound(PriceFeedNotFound),
    StalePrice(StalePrice),
    InvalidWormholeVaa(InvalidWormholeVaa),
    InvalidGovernanceMessage(InvalidGovernanceMessage),
    InvalidGovernanceTarget(InvalidGovernanceTarget),
    InvalidGovernanceDataSource(InvalidGovernanceDataSource),
    OldGovernanceMessage(OldGovernanceMessage),
    InvalidWormholeAddressToSet(InvalidWormholeAddressToSet),
    FalledDecodeData(FalledDecodeData),
}

impl MethodError for Error {
    fn encode(self) -> alloc::vec::Vec<u8> {
        self.into()
    }
}
