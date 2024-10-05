use alloy::{
    sol_types::SolError,
    transports::{RpcError, TransportErrorKind},
};

/// Possible panic codes for a revert.
///
/// Taken from <https://github.com/NomicFoundation/hardhat/blob/main/packages/hardhat-chai-matchers/src/internal/reverted/panic.ts>
#[derive(Debug)]
#[allow(missing_docs)] // Pretty straightforward variant names.
pub enum PanicCode {
    AssertionError = 0x1,
    ArithmeticOverflow = 0x11,
    DivisionByZero = 0x12,
    EnumConversionOutOfBounds = 0x21,
    IncorrectlyEncodedStorageByteArray = 0x22,
    PopOnEmptyArray = 0x31,
    ArrayAccessOutOfBounds = 0x32,
    TooMuchMemoryAllocated = 0x41,
    ZeroInitializedVariable = 0x51,
}

impl core::fmt::Display for PanicCode {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let msg = match self {
            PanicCode::AssertionError =>
                "Assertion error",
            PanicCode::ArithmeticOverflow =>
                "Arithmetic operation overflowed outside of an unchecked block",
            PanicCode::DivisionByZero =>
                "Division or modulo division by zero",
            PanicCode::EnumConversionOutOfBounds =>
                "Tried to convert a value into an enum, but the value was too big or negative",
            PanicCode::IncorrectlyEncodedStorageByteArray =>
                "Incorrectly encoded storage byte array",
            PanicCode::PopOnEmptyArray =>
                ".pop() was called on an empty array",
            PanicCode::ArrayAccessOutOfBounds =>
                "Array accessed at an out-of-bounds or negative index",
            PanicCode::TooMuchMemoryAllocated =>
                "Too much memory was allocated, or an array was created that is too large",
            PanicCode::ZeroInitializedVariable =>
                "Called a zero-initialized variable of internal function type"
        };

        write!(f, "{}", msg)
    }
}

/// An error representing a panic.
pub trait Panic {
    /// Checks that `Self` corresponds to a panic with code `code`.
    fn panicked_with(&self, code: PanicCode) -> bool;
}

/// An error representing a revert with some data.
pub trait Revert<E> {
    /// Checks that `Self` corresponds to the typed abi-encoded error
    /// `expected`.
    fn reverted_with(&self, expected: E) -> bool;
}

impl Panic for alloy::contract::Error {
    fn panicked_with(&self, _code: PanicCode) -> bool {
        let Self::TransportError(e) = self else {
            return false;
        };

        // FIXME: right now we cannot have any better error code for Panics
        // check `e`:
        //  ErrorResp(
        //      ErrorPayload {
        //          code: -32000,
        //          message: "execution reverted",
        //          data: None,
        //      },
        //  )
        let payload = e.as_error_resp().expect("should contain payload");
        payload.code == -32000 && payload.message == "execution reverted"
    }
}

impl<E: SolError> Revert<E> for alloy::contract::Error {
    fn reverted_with(&self, expected: E) -> bool {
        let Self::TransportError(e) = self else {
            return false;
        };

        let raw_value = e
            .as_error_resp()
            .and_then(|payload| payload.data.clone())
            .expect("should extract the error");
        let actual = &raw_value.get().trim_matches('"')[2..];
        let expected = alloy::hex::encode(expected.abi_encode());
        expected == actual
    }
}

impl<E: SolError> Revert<E> for eyre::Report {
    fn reverted_with(&self, expected: E) -> bool {
        let Some(received) = self
            .chain()
            .find_map(|err| err.downcast_ref::<RpcError<TransportErrorKind>>())
        else {
            return false;
        };
        let RpcError::ErrorResp(received) = received else {
            return false;
        };
        let Some(received) = &received.data else {
            return false;
        };
        let expected = alloy::hex::encode(expected.abi_encode());
        received.to_string().contains(&expected)
    }
}
