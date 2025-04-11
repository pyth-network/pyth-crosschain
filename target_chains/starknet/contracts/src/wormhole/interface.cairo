use pyth::byte_buffer::ByteBuffer;
use starknet::EthAddress;
use starknet::secp256_trait::Signature;
use super::errors::SubmitNewGuardianSetError;

/// Wormhole provides a secure means for communication between multiple chains.
/// This contract allows users to parse and verify a Wormhole message that informs
/// them about a message that was produced by a contract on a Wormhole-supported chain.
///
/// Note that this implementation does not support creating Wormhole messages.
#[starknet::interface]
pub trait IWormhole<T> {
    /// Parses and returns the contents of the message. Panics if there was a
    /// parsing error or if signature verification failed.
    /// `ParseAndVerifyVmError` enumerates possible panic payloads.
    fn parse_and_verify_vm(self: @T, encoded_vm: ByteBuffer) -> VerifiedVM;

    /// Returns the list of guardians at the specified index.
    /// `GetGuardianSetError` enumerates possible panic payloads.
    fn get_guardian_set(self: @T, index: u32) -> GuardianSet;

    /// Returns the index of the latest guardian set. Guardian sets with
    /// lower indexes may still be supported unless they have already expired.
    fn get_current_guardian_set_index(self: @T) -> u32;

    /// Checks whether the governance action with the specified hash has already
    /// been consumed by this contract. Actions that have been consumed cannot
    /// be executed again.
    fn governance_action_is_consumed(self: @T, hash: u256) -> bool;

    /// Returns the ID of the chain on which the contract has been deployed.
    fn chain_id(self: @T) -> u16;

    /// Returns the ID of the chain containing the Wormhole governance contract.
    fn governance_chain_id(self: @T) -> u16;

    /// Returns the address of the Wormhole governance contract.
    fn governance_contract(self: @T) -> u256;

    // We don't need to implement other governance actions for now.
    // Instead of upgrading the Wormhole contract, we can switch to another Wormhole address
    // in the Pyth contract.

    /// Executes a governance instruction to add a new guardian set. The new set becomes
    /// active immediately. The previous guardian set will be available for 24 hours and then
    /// expire.
    /// `SubmitNewGuardianSetError` enumerates possible panic payloads.
    fn submit_new_guardian_set(ref self: T, encoded_vm: ByteBuffer);
}

/// Information about a guardian's signature within a message.
#[derive(Drop, Copy, Debug, PartialEq, Serde, Hash, starknet::Store)]
pub struct GuardianSignature {
    /// Index of this guardian within the guardian set.
    pub guardian_index: u8,
    /// The guardian's signature of the message.
    pub signature: Signature,
}

/// A verified Wormhole message.
#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct VerifiedVM {
    /// Version of the encoding format.
    pub version: u8,
    /// Index of the guardian set that signed this message.
    pub guardian_set_index: u32,
    /// Signatures of guardians.
    pub signatures: Array<GuardianSignature>,
    /// Creation time of the message.
    pub timestamp: u32,
    /// Unique nonce of the message.
    pub nonce: u32,
    /// ID of the chain on which the message was sent.
    pub emitter_chain_id: u16,
    /// Address of the contract that sent the message.
    pub emitter_address: u256,
    /// Sequence number of the message.
    pub sequence: u64,
    /// Observed consistency level (specific to the sender's chain).
    pub consistency_level: u8,
    /// The data attached to the message.
    pub payload: ByteBuffer,
    /// Double keccak256 hash of all fields of the message, excluding `version`,
    /// `guardian_set_index` and `signatures`.
    pub hash: u256,
}

/// Returns the number of signatures required to verify a message.
pub fn quorum(num_guardians: usize) -> usize {
    assert(num_guardians < 256, SubmitNewGuardianSetError::TooManyGuardians.into());
    ((num_guardians * 2) / 3) + 1
}

/// Information about a guardian set.
#[derive(Drop, Clone, Debug, PartialEq, Serde)]
pub struct GuardianSet {
    /// Public keys of guardians, in order.
    pub keys: Array<EthAddress>,
    /// Timestamp of expiration, if any. The contract will not verify messages signed by
    /// this guardian set if the guardian set has expired. The latest guardian set
    /// does not have an expiration time.
    pub expiration_time: Option<u64>,
}
