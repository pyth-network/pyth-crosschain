/// Types and functions for processing governance messages.
module pyth_lazer::governance;

#[test_only]
use wormhole::external_address;
use wormhole::{
    external_address::ExternalAddress,
    vaa::VAA,
};

use pyth_lazer::{meta, parser::Parser};

/// Reference:
/// https://github.com/pyth-network/pyth-crosschain/blob/b021cfe9b2716947f22d1724cd3fa7e3de6b026e/governance/remote_executor/programs/remote-executor/src/state/governance_payload.rs#L81
const MAGIC: vector<u8> = "PTGM";

/// Governace message module. Always 3, as this contract uses "Lazer" actions.
const MODULE: u8 = 3;

#[error]
const EMismatchedMagic: vector<u8> = "Mismatched governance header magic number, should be \"PTGM\"";
#[error]
const EMismatchedModule: vector<u8> = "Mismatched governance header module number, should be 3";
#[error]
const EMismatchedEmitterChainID: vector<u8> = "Mismatched governance emitter chain ID";
#[error]
const EMismatchedReceiverChainID: vector<u8> = "Mismatched governance receiver chain ID";
#[error]
const EMismatchedAddress: vector<u8> = "Mismatched governance emitter address";
#[error]
const EOldSequenceNumber: vector<u8> = "Incoming sequence number older than previously seen";

/// State used to track and validate governance messages coming as VAAs.
public struct Governance has copy, drop, store {
    chain_id: u16,
    address: ExternalAddress,
    seen_sequence: u64,
}

public(package) fun new(chain_id: u16, address: ExternalAddress): Governance {
    Governance {
        chain_id,
        address,
        seen_sequence: 0,
    }
}

#[test_only]
public(package) fun dummy(): Governance {
    new(0, external_address::default())
}

/// Process incoming VAA message parameters, asserting that the message is safe
/// to process further. Returns message payload.
public(package) fun process_incoming(
    self: &mut Governance,
    vaa: VAA
): vector<u8> {
    let sequence = vaa.sequence();
    let (chain_id, address, payload) = vaa.take_emitter_info_and_payload();
    assert!(self.chain_id == chain_id, EMismatchedEmitterChainID);
    assert!(self.address == address, EMismatchedAddress);
    assert!(self.seen_sequence < sequence, EOldSequenceNumber);
    self.seen_sequence = sequence;
    payload
}

/// Reference:
/// https://github.com/pyth-network/pyth-crosschain/blob/b021cfe9b2716947f22d1724cd3fa7e3de6b026e/governance/remote_executor/programs/remote-executor/src/state/governance_payload.rs#L86
public struct GovernanceHeader has drop {
    action: u8,
}

// Governance action "enum" implemented as a collection of package-private
// predicates to allow modification in the future, as Sui types cannot be
// private (yet?):

public(package) fun is_upgrade_lazer_contract(self: &GovernanceHeader): bool {
    self.action == 0
}

public(package) fun is_update_trusted_signer(self: &GovernanceHeader): bool {
    self.action == 1
}

/// Reference:
/// https://github.com/pyth-network/pyth-crosschain/blob/b021cfe9b2716947f22d1724cd3fa7e3de6b026e/governance/xc_admin/packages/xc_admin_common/src/governance_payload/PythGovernanceAction.ts#L86
public(package) fun parse_header(parser: &mut Parser): GovernanceHeader {
    let magic = parser.take_bytes(4);
    assert!(magic == MAGIC, EMismatchedMagic);
    let module_ = parser.take_u8();
    assert!(module_ == MODULE, EMismatchedModule);
    let action = parser.take_u8();
    let chain = parser.take_u16_be();
    assert!(chain == meta::receiver_chain_id(), EMismatchedReceiverChainID);
    GovernanceHeader { action }
}
