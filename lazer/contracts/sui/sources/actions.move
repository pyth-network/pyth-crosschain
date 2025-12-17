/// Governance actions of the Lazer contract.
module pyth_lazer::actions;

use sui::package::{UpgradeCap, UpgradeReceipt, UpgradeTicket};

use wormhole::{bytes32, external_address, vaa::VAA};

use pyth_lazer::{
    governance,
    state::{Self, secp256k1_compressed_pubkey_len, State},
};

#[error]
const ENotUpgradeContractVAA: vector<u8> = "Expected upgrade contract VAA message";
#[error]
const ENotUpdateTrustedSignerVAA: vector<u8> = "Expected update trusted signer VAA message";

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

public fun upgrade_contract(state: &mut State, vaa: VAA): UpgradeTicket {
    let current_cap = state.current_cap();
    let (header, mut parser) = state.unwrap_vaa(&current_cap, vaa);
    assert!(header.is_upgrade_contract(), ENotUpgradeContractVAA);
    let digest = parser.take_bytes(32);
    parser.destroy_empty();
    state.authorize_upgrade(&current_cap, digest)
}

public fun commit_upgrade(state: &mut State, receipt: UpgradeReceipt) {
    let current_cap = state.current_cap();
    state.commit_upgrade(&current_cap, receipt)
}

public fun update_trusted_signer(state: &mut State, vaa: VAA) {
    let current_cap = state.current_cap();
    let (header, mut parser) = state.unwrap_vaa(&current_cap, vaa);
    assert!(header.is_update_trusted_signer(), ENotUpdateTrustedSignerVAA);
    let public_key = parser.take_bytes(secp256k1_compressed_pubkey_len());
    let expires_at = parser.take_u64_be();
    parser.destroy_empty();
    state.update_trusted_signer(&current_cap, public_key, expires_at);
}
