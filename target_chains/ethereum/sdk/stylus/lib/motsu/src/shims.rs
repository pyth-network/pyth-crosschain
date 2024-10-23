//! Shims that mock common host imports in Stylus `wasm` programs.
//!
//! Most of the documentation is taken from the [Stylus source].
//!
//! We allow unsafe here because safety is guaranteed by the Stylus team.
//!
//! [Stylus source]: https://github.com/OffchainLabs/stylus/blob/484efac4f56fb70f96d4890748b8ec2543d88acd/arbitrator/wasm-libraries/user-host-trait/src/lib.rs
//!
//! ## Motivation
//!
//! Without these shims we can't currently run unit tests for stylus contracts,
//! since the symbols the compiled binaries expect to find are not there.
//!
//! If you run `cargo test` on a fresh Stylus project, it will error with:
//!
//! ```terminal
//! dyld[97792]: missing symbol called
//! ```
//!
//! This crate is a temporary solution until the Stylus team provides us with a
//! different and more stable mechanism for unit-testing our contracts.
//!
//! ## Usage
//!
//! Import these shims in your test modules as `motsu::prelude::*` to populate
//! the namespace with the appropriate symbols.
//!
//! ```rust,ignore
//! #[cfg(test)]
//! mod tests {
//!     use contracts::token::erc20::Erc20;
//!
//!     #[motsu::test]
//!     fn reads_balance(contract: Erc20) {
//!         let balance = contract.balance_of(Address::ZERO); // Access storage.
//!         assert_eq!(balance, U256::ZERO);
//!     }
//! }
//! ```
//!
//! Note that for proper usage, tests should have exclusive access to storage,
//! since they run in parallel, which may cause undesired results.
//!
//! One solution is to wrap tests with a function that acquires a global mutex:
//!
//! ```rust,no_run
//! use std::sync::{Mutex, MutexGuard};
//!
//! use motsu::prelude::reset_storage;
//!
//! pub static STORAGE_MUTEX: Mutex<()> = Mutex::new(());
//!
//! pub fn acquire_storage() -> MutexGuard<'static, ()> {
//!     STORAGE_MUTEX.lock().unwrap()
//! }
//!
//! pub fn with_context<C: Default>(closure: impl FnOnce(&mut C)) {
//!     let _lock = acquire_storage();
//!     let mut contract = C::default();
//!     closure(&mut contract);
//!     reset_storage();
//! }
//!
//! #[motsu::test]
//! fn reads_balance() {
//!     let balance = token.balance_of(Address::ZERO);
//!     assert_eq!(balance, U256::ZERO);
//! }
//! ```
#![allow(clippy::missing_safety_doc)]
use std::slice;

use tiny_keccak::{Hasher, Keccak};

use crate::storage::{read_bytes32, write_bytes32, STORAGE};

pub(crate) const WORD_BYTES: usize = 32;
pub(crate) type Bytes32 = [u8; WORD_BYTES];

/// Efficiently computes the [`keccak256`] hash of the given preimage.
/// The semantics are equivalent to that of the EVM's [`SHA3`] opcode.
///
/// [`keccak256`]: https://en.wikipedia.org/wiki/SHA-3
/// [`SHA3`]: https://www.evm.codes/#20
#[no_mangle]
pub unsafe extern "C" fn native_keccak256(
    bytes: *const u8,
    len: usize,
    output: *mut u8,
) {
    let mut hasher = Keccak::v256();

    let data = unsafe { slice::from_raw_parts(bytes, len) };
    hasher.update(data);

    let output = unsafe { slice::from_raw_parts_mut(output, WORD_BYTES) };
    hasher.finalize(output);
}

/// Reads a 32-byte value from permanent storage. Stylus's storage format is
/// identical to that of the EVM. This means that, under the hood, this hostio
/// is accessing the 32-byte value stored in the EVM state trie at offset
/// `key`, which will be `0` when not previously set. The semantics, then, are
/// equivalent to that of the EVM's [`SLOAD`] opcode.
///
/// [`SLOAD`]: https://www.evm.codes/#54
///
/// # Panics
///
/// May panic if unable to lock `STORAGE`.
#[no_mangle]
pub unsafe extern "C" fn storage_load_bytes32(key: *const u8, out: *mut u8) {
    let key = unsafe { read_bytes32(key) };

    let value = STORAGE
        .lock()
        .unwrap()
        .get(&key)
        .map(Bytes32::to_owned)
        .unwrap_or_default();

    unsafe { write_bytes32(out, value) };
}

/// Writes a 32-byte value to the permanent storage cache. Stylus's storage
/// format is identical to that of the EVM. This means that, under the hood,
/// this hostio represents storing a 32-byte value into the EVM state trie at
/// offset `key`. Refunds are tabulated exactly as in the EVM. The semantics,
/// then, are equivalent to that of the EVM's [`SSTORE`] opcode.
///
/// Note: because the value is cached, one must call `storage_flush_cache` to
/// persist it.
///
/// [`SSTORE`]: https://www.evm.codes/#55
///
/// # Panics
///
/// May panic if unable to lock `STORAGE`.
#[no_mangle]
pub unsafe extern "C" fn storage_cache_bytes32(
    key: *const u8,
    value: *const u8,
) {
    let (key, value) = unsafe { (read_bytes32(key), read_bytes32(value)) };
    STORAGE.lock().unwrap().insert(key, value);
}

/// Persists any dirty values in the storage cache to the EVM state trie,
/// dropping the cache entirely if requested. Analogous to repeated invocations
/// of [`SSTORE`].
///
/// [`SSTORE`]: https://www.evm.codes/#55
pub fn storage_flush_cache(_: bool) {
    // No-op: we don't use the cache in our unit-tests.
}

/// Dummy msg sender set for tests.
pub const MSG_SENDER: &[u8; 42] = b"0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";

/// Dummy contract address set for tests.
pub const CONTRACT_ADDRESS: &[u8; 42] =
    b"0xdCE82b5f92C98F27F116F70491a487EFFDb6a2a9";

/// Arbitrum's CHAID ID.
pub const CHAIN_ID: u64 = 42161;

/// Externally Owned Account (EOA) code hash.
pub const EOA_CODEHASH: &[u8; 66] =
    b"0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

/// Gets the address of the account that called the program. For normal
/// L2-to-L2 transactions the semantics are equivalent to that of the EVM's
/// [`CALLER`] opcode, including in cases arising from [`DELEGATE_CALL`].
///
/// For L1-to-L2 retryable ticket transactions, the top-level sender's address
/// will be aliased. See [`Retryable Ticket Address Aliasing`][aliasing] for
/// more information on how this works.
///
/// [`CALLER`]: https://www.evm.codes/#33
/// [`DELEGATE_CALL`]: https://www.evm.codes/#f4
/// [aliasing]: https://developer.arbitrum.io/arbos/l1-to-l2-messaging#address-aliasing
///
/// # Panics
///
/// May panic if fails to parse `MSG_SENDER` as an address.
#[no_mangle]
pub unsafe extern "C" fn msg_sender(sender: *mut u8) {
    let addr = const_hex::const_decode_to_array::<20>(MSG_SENDER).unwrap();
    std::ptr::copy(addr.as_ptr(), sender, 20);
}

/// Gets the address of the current program. The semantics are equivalent to
/// that of the EVM's [`ADDRESS`] opcode.
///
/// [`ADDRESS`]: https://www.evm.codes/#30
///
/// # Panics
///
/// May panic if fails to parse `CONTRACT_ADDRESS` as an address.
#[no_mangle]
pub unsafe extern "C" fn contract_address(address: *mut u8) {
    let addr =
        const_hex::const_decode_to_array::<20>(CONTRACT_ADDRESS).unwrap();
    std::ptr::copy(addr.as_ptr(), address, 20);
}

/// Gets the chain ID of the current chain. The semantics are equivalent to
/// that of the EVM's [`CHAINID`] opcode.
///
/// [`CHAINID`]: https://www.evm.codes/#46
#[no_mangle]
pub unsafe extern "C" fn chainid() -> u64 {
    CHAIN_ID
}

/// Emits an EVM log with the given number of topics and data, the first bytes
/// of which should be the 32-byte-aligned topic data. The semantics are
/// equivalent to that of the EVM's [`LOG0`], [`LOG1`], [`LOG2`], [`LOG3`], and
/// [`LOG4`] opcodes based on the number of topics specified. Requesting more
/// than `4` topics will induce a revert.
///
/// [`LOG0`]: https://www.evm.codes/#a0
/// [`LOG1`]: https://www.evm.codes/#a1
/// [`LOG2`]: https://www.evm.codes/#a2
/// [`LOG3`]: https://www.evm.codes/#a3
/// [`LOG4`]: https://www.evm.codes/#a4
#[no_mangle]
pub unsafe extern "C" fn emit_log(_: *const u8, _: usize, _: usize) {
    // No-op: we don't check for events in our unit-tests.
}

/// Gets the code hash of the account at the given address.
/// The semantics are equivalent to that of the EVM's [`EXT_CODEHASH`] opcode.
/// Note that the code hash of an account without code will be the empty hash
/// `keccak("") =
///     c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`.
///
/// [`EXT_CODEHASH`]: https://www.evm.codes/#3F
///
/// # Panics
///
/// May panic if fails to parse `ACCOUNT_CODEHASH` as a keccack hash.
#[no_mangle]
pub unsafe extern "C" fn account_codehash(_address: *const u8, dest: *mut u8) {
    let account_codehash =
        const_hex::const_decode_to_array::<32>(EOA_CODEHASH).unwrap();

    std::ptr::copy(account_codehash.as_ptr(), dest, 32);
}

/// Returns the length of the last EVM call or deployment return result, or `0`
/// if neither have happened during the program's execution. The semantics are
/// equivalent to that of the EVM's [`RETURN_DATA_SIZE`] opcode.
///
/// [`RETURN_DATA_SIZE`]: https://www.evm.codes/#3d
#[no_mangle]
pub unsafe extern "C" fn return_data_size() -> usize {
    // TODO: #156
    // No-op: we do not use this function in our unit-tests,
    // but the binary does include it.
    0
}

/// Copies the bytes of the last EVM call or deployment return result. Does not
/// revert if out of bounds, but rather copies the overlapping portion. The
/// semantics are otherwise equivalent to that of the EVM's [`RETURN_DATA_COPY`]
/// opcode.
///
/// Returns the number of bytes written.
///
/// [`RETURN_DATA_COPY`]: https://www.evm.codes/#3e
#[no_mangle]
pub unsafe extern "C" fn read_return_data(
    _dest: *mut u8,
    _offset: usize,
    _size: usize,
) -> usize {
    // TODO: #156
    // No-op: we do not use this function in our unit-tests,
    // but the binary does include it.
    0
}

/// Calls the contract at the given address with options for passing value and
/// to limit the amount of gas supplied. The return status indicates whether the
/// call succeeded, and is nonzero on failure.
///
/// In both cases `return_data_len` will store the length of the result, the
/// bytes of which can be read via the `read_return_data` hostio. The bytes are
/// not returned directly so that the programmer can potentially save gas by
/// choosing which subset of the return result they'd like to copy.
///
/// The semantics are equivalent to that of the EVM's [`CALL`] opcode, including
/// callvalue stipends and the 63/64 gas rule. This means that supplying the
/// `u64::MAX` gas can be used to send as much as possible.
///
/// [`CALL`]: https://www.evm.codes/#f1
#[no_mangle]
pub unsafe extern "C" fn call_contract(
    _contract: *const u8,
    _calldata: *const u8,
    _calldata_len: usize,
    _value: *const u8,
    _gas: u64,
    _return_data_len: *mut usize,
) -> u8 {
    // TODO: #156
    // No-op: we do not use this function in our unit-tests,
    // but the binary does include it.
    0
}

/// Static calls the contract at the given address, with the option to limit the
/// amount of gas supplied. The return status indicates whether the call
/// succeeded, and is nonzero on failure.
///
/// In both cases `return_data_len` will store the length of the result, the
/// bytes of which can be read via the `read_return_data` hostio. The bytes are
/// not returned directly so that the programmer can potentially save gas by
/// choosing which subset of the return result they'd like to copy.
///
/// The semantics are equivalent to that of the EVM's [`STATIC_CALL`] opcode,
/// including the 63/64 gas rule. This means that supplying `u64::MAX` gas can
/// be used to send as much as possible.
///
/// [`STATIC_CALL`]: https://www.evm.codes/#FA
#[no_mangle]
pub unsafe extern "C" fn static_call_contract(
    _contract: *const u8,
    _calldata: *const u8,
    _calldata_len: usize,
    _gas: u64,
    _return_data_len: *mut usize,
) -> u8 {
    // TODO: #156
    // No-op: we do not use this function in our unit-tests,
    // but the binary does include it.
    0
}

/// Delegate calls the contract at the given address, with the option to limit
/// the amount of gas supplied. The return status indicates whether the call
/// succeeded, and is nonzero on failure.
///
/// In both cases `return_data_len` will store the length of the result, the
/// bytes of which can be read via the `read_return_data` hostio. The bytes are
/// not returned directly so that the programmer can potentially save gas by
/// choosing which subset of the return result they'd like to copy.
///
/// The semantics are equivalent to that of the EVM's [`DELEGATE_CALL`] opcode,
/// including the 63/64 gas rule. This means that supplying `u64::MAX` gas can
/// be used to send as much as possible.
///
/// [`DELEGATE_CALL`]: https://www.evm.codes/#F4
#[no_mangle]
pub unsafe extern "C" fn delegate_call_contract(
    _contract: *const u8,
    _calldata: *const u8,
    _calldata_len: usize,
    _gas: u64,
    _return_data_len: *mut usize,
) -> u8 {
    // TODO: #156
    // No-op: we do not use this function in our unit-tests,
    // but the binary does include it.
    0
}

/// Gets a bounded estimate of the Unix timestamp at which the Sequencer
/// sequenced the transaction. See [`Block Numbers and Time`] for more
/// information on how this value is determined.
///
/// [`Block Numbers and Time`]: https://developer.arbitrum.io/time
#[no_mangle]
pub unsafe extern "C" fn block_timestamp() -> u64 {
    // Epoch timestamp: 1st January 2025 00::00::00
    1_735_689_600
}
