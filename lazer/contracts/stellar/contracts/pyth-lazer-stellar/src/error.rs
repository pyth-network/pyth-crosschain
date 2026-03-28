use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidMagic = 3,
    TruncatedData = 4,
    InvalidPayloadLength = 5,
    SignerNotTrusted = 6,
    SignerExpired = 7,
    Unauthorized = 8,
}
