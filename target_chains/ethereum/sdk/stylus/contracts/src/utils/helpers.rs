use stylus_sdk::{
    alloy_primitives::Address,
    call::{call, delegate_call, static_call},
    storage::TopLevelStorage,
};
use alloy_sol_types::{SolCall, SolType};
use alloc::vec::Vec;


/// The revert message when failing to decode the data
/// returned by an external contract call
pub const CALL_RETDATA_DECODING_ERROR_MESSAGE: &[u8] = b"error decoding retdata";

/// Maps an error returned from an external contract call to a `Vec<u8>`,
/// which is the expected return type of external contract methods.
pub fn map_call_error(e: stylus_sdk::call::Error) -> Vec<u8> {
    match e {
        stylus_sdk::call::Error::Revert(msg) => msg,
        stylus_sdk::call::Error::AbiDecodingFailed(_) => {
            CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec()
        }
    }
}

/// Performs a `delegate call` to the given address, calling the function
/// defined as a `SolCall` with the given arguments.

pub fn delegate_call_helper<C: SolCall>(
    storage: &mut impl TopLevelStorage,
    address: Address,
    args: <C::Parameters<'_> as SolType>::RustType,
) -> Result<C::Return, Vec<u8>> {
    let calldata = C::new(args).abi_encode();
    let res = unsafe { delegate_call(storage, address, &calldata).map_err(map_call_error)? };
    C::abi_decode_returns(&res, false /* validate */)
        .map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec())
}

/// Performs a `staticcall` to the given address, calling the function defined as a `SolCall` with the given arguments

pub fn static_call_helper<C: SolCall>(
    storage: &impl TopLevelStorage,
    address: Address,
    args: <C::Parameters<'_> as SolType>::RustType,
) -> Result<C::Return, Vec<u8>> {
    let calldata = C::new(args).abi_encode();
    let res = static_call(storage, address, &calldata).map_err(map_call_error)?;
    C::abi_decode_returns(&res, false /* validate */)
        .map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec())
}

/// Performs a `call` to the given address, calling the function
/// defined as a `SolCall` with the given arguments.
pub fn call_helper<C: SolCall>(
    storage: &mut impl TopLevelStorage,
    address: Address,
    args: <C::Parameters<'_> as SolType>::RustType,
) -> Result<C::Return, Vec<u8>> {
    let calldata = C::new(args).abi_encode();
    let res = call(storage, address, &calldata).map_err(map_call_error)?;
    C::abi_decode_returns(&res, false /* validate */)
        .map_err(|_| CALL_RETDATA_DECODING_ERROR_MESSAGE.to_vec())
}