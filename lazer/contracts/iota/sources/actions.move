/// Governance actions of the Lazer contract.
module pyth_lazer::actions;

#[test_only]
use std::unit_test::assert_eq;
use iota::package::{UpgradeCap, UpgradeReceipt, UpgradeTicket};

#[test_only]
use wormhole::vaa;
use wormhole::{bytes32, external_address, vaa::VAA};

#[test_only]
use pyth_lazer::governance::Governance;
use pyth_lazer::{
    governance,
    meta,
    state::{Self, secp256k1_compressed_pubkey_len, State},
};

#[error]
const ENotUpgradeLazerContract: vector<u8> = b"Expected UpgradeSuiLazerContract message";
#[error]
const ENotUpdateTrustedSigner: vector<u8> = b"Expected UpdateTrustedSigner message";
#[error]
const EInvalidUpgradeVersion: vector<u8> = b"Invalid upgrade version, must be higher exactly by one";

/// Entrypoint for initializing the Lazer contract.
entry fun init_lazer(
    upgrade_cap: UpgradeCap,
    emitter_chain_id: u16,
    emitter_address: vector<u8>,
    ctx: &mut TxContext
) {
    let governance = governance::new(
        emitter_chain_id,
        external_address::new_nonzero(bytes32::new(emitter_address))
    );
    state::share(upgrade_cap, governance, ctx);
}

// Reference: `UpgradeSuiLazerContract`
public fun upgrade(state: &mut State, vaa: VAA): UpgradeTicket {
    let current_cap = state.current_cap();
    let (header, mut parser) = state.unwrap_ptgm(&current_cap, vaa);
    assert!(header.is_upgrade_lazer_contract(), ENotUpgradeLazerContract);

    let version = parser.take_u64_be();
    assert!(version == meta::version() + 1, EInvalidUpgradeVersion);

    let digest = parser.take_bytes(32);
    parser.destroy_empty();
    state.authorize_upgrade(&current_cap, digest)
}

public fun commit_upgrade(state: &mut State, receipt: UpgradeReceipt) {
    let current_cap = state.current_cap();
    state.commit_upgrade(&current_cap, receipt)
}

// Reference: `UpdateTrustedSigner264Bit`
public fun update_trusted_signer(state: &mut State, vaa: VAA) {
    let current_cap = state.current_cap();
    let (header, mut parser) = state.unwrap_ptgm(&current_cap, vaa);
    assert!(header.is_update_trusted_signer(), ENotUpdateTrustedSigner);

    let public_key = parser.take_bytes(secp256k1_compressed_pubkey_len());
    let expires_at = parser.take_u64_be();
    parser.destroy_empty();
    state.update_trusted_signer(&current_cap, public_key, expires_at);
}

// TODO: test assumes current version 1 - make it parameterized?
#[test_only]
const TEST_UPGRADE_VAA: vector<u8> = vector[1,0,0,0,0,1,0,62,191,234,208,186,78,125,210,45,4,92,222,86,204,156,241,198,137,172,250,223,202,62,169,134,101,126,196,192,193,208,2,42,239,153,148,22,28,185,33,169,145,83,144,129,19,10,250,137,126,68,69,147,34,15,88,251,181,223,210,68,218,3,57,1,105,96,189,159,0,0,0,0,0,1,163,98,52,239,55,73,162,201,65,54,182,52,91,206,255,69,7,145,239,30,188,153,233,24,241,111,128,117,164,65,187,36,0,0,0,0,0,0,0,3,1,80,84,71,77,3,0,195,198,0,0,0,0,0,0,0,2,150,25,135,237,196,172,202,28,255,8,183,26,248,190,44,218,232,231,228,145,102,251,208,126,38,83,236,196,200,98,162,166];

#[test_only]
const TEST_UPDATE_TRUSTED_SIGNER_ADD: vector<u8> = vector[1,0,0,0,0,1,0,234,83,124,39,121,208,192,140,211,201,103,211,97,61,215,254,114,47,118,191,136,20,228,116,80,133,16,111,240,32,247,248,48,10,199,239,3,72,136,238,68,232,44,18,193,79,147,63,125,15,98,29,171,66,188,10,95,30,230,125,192,131,134,45,0,106,95,70,49,0,0,0,0,0,1,11,254,215,118,242,4,212,154,104,231,232,41,51,43,43,216,92,147,140,114,234,120,164,66,174,221,197,220,63,183,47,12,0,0,0,0,0,0,0,1,1,80,84,71,77,3,1,195,198,3,164,56,15,1,19,110,178,100,15,144,193,126,30,49,158,2,187,175,190,239,46,110,103,220,72,175,83,249,130,126,21,91,0,0,0,0,125,46,145,224];

#[test_only]
const TEST_UPDATE_TRUSTED_SIGNER_REMOVE: vector<u8> = vector[1,0,0,0,0,1,0,126,229,228,215,73,253,91,76,106,169,218,253,166,44,124,73,160,137,101,208,42,14,31,50,50,159,142,115,96,250,75,21,28,255,109,56,88,214,114,100,168,141,151,198,96,216,246,79,179,46,99,200,178,135,166,181,2,17,188,60,92,27,119,247,1,105,96,191,6,0,0,0,0,0,1,163,98,52,239,55,73,162,201,65,54,182,52,91,206,255,69,7,145,239,30,188,153,233,24,241,111,128,117,164,65,187,36,0,0,0,0,0,0,0,4,1,80,84,71,77,3,1,195,198,3,164,56,15,1,19,110,178,100,15,144,193,126,30,49,158,2,187,175,190,239,46,110,103,220,72,175,83,249,130,126,21,91,0,0,0,0,0,0,0,0];

#[test_only]
const TEST_TRUSTED_SIGNER: vector<u8> = x"03a4380f01136eb2640f90c17e1e319e02bbafbeef2e6e67dc48af53f9827e155b";

#[test_only]
const TEST_GOVERNANCE_ADDRESS: vector<u8> = x"a36234ef3749a2c94136b6345bceff450791ef1ebc99e918f16f8075a441bb24";

#[test_only]
const TEST_UPDATE_TRUSTED_SIGNER_ADD_GOVERNANCE_ADDRESS: vector<u8> = x"0bfed776f204d49a68e7e829332b2bd85c938c72ea78a442aeddc5dc3fb72f0c";

#[test_only]
fun test_governance(address: vector<u8>): Governance {
    governance::new(1, external_address::new(bytes32::new(address)))
}

#[test]
public fun test_upgrade() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, test_governance(TEST_GOVERNANCE_ADDRESS));

    let (_, verifiedVaa) = vaa::parse_test_only(TEST_UPGRADE_VAA);
    let ticket = upgrade(&mut state, verifiedVaa);

    let receipt = ticket.test_upgrade();
    commit_upgrade(&mut state, receipt);

    state.destroy();
}

#[test]
public fun test_update_trusted_signer_add() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(
        &mut ctx,
        test_governance(TEST_UPDATE_TRUSTED_SIGNER_ADD_GOVERNANCE_ADDRESS)
    );
    let current_cap = state.current_cap();

    let (_, verifiedVaa) = vaa::parse_test_only(TEST_UPDATE_TRUSTED_SIGNER_ADD);
    update_trusted_signer(&mut state, verifiedVaa);

    let signers = state.trusted_signers(&current_cap);
    assert_eq!(signers.length(), 1);
    let signer = &signers[0];
    assert_eq!(signer.expires_at_ms(), 2100204000 * 1000);
    assert_eq!(*signer.public_key(), TEST_TRUSTED_SIGNER);

    state.destroy();
}

#[test]
public fun test_update_trusted_signer_remove() {
    let mut ctx = tx_context::dummy();
    let mut state = state::new_for_test(&mut ctx, test_governance(TEST_GOVERNANCE_ADDRESS));
    let current_cap = state.current_cap();

    state.update_trusted_signer(&current_cap, TEST_TRUSTED_SIGNER, 1799422709);
    assert_eq!(state.trusted_signers(&current_cap).length(), 1);

    let (_, verifiedVaa) = vaa::parse_test_only(TEST_UPDATE_TRUSTED_SIGNER_REMOVE);
    update_trusted_signer(&mut state, verifiedVaa);

    let signers = state.trusted_signers(&current_cap);
    assert_eq!(signers.length(), 0);

    state.destroy();
}
