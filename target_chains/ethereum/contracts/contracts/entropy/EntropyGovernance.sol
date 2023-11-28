// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyState.sol";
import "./EntropyGovernanceInstructions.sol";
import "../libraries/external/BytesLib.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Pyth contract.
 */
abstract contract EntropyGovernance is
    EntropyState,
    EntropyGovernanceInstructions
{
    using BytesLib for bytes;

    modifier onlyAdmin() {
        require(msg.sender == _state.admin);
        _;
    }

    function executeGovernanceInstruction(
        bytes memory payload
    ) external onlyAdmin {
        GovernanceInstruction memory gi = parseGovernanceInstruction(payload);

        if (gi.action == GovernanceAction.UpgradeContract) {
            // FIXME: this probably needs a check on the chain id
            upgradeContract(parseUpgradeContractPayload(gi.payload));
        } else if (gi.action == GovernanceAction.SetAdmin) {
            _state.admin = parseSetAdminPayload(gi.payload).newAdmin;
        } else if (gi.action == GovernanceAction.SetFee) {
            _state.pythFeeInWei = parseSetFeePayload(gi.payload).newFee;
        } else {
            revert EntropyErrors.InvalidGovernanceMessage();
        }
    }

    function upgradeContract(UpgradeContractPayload memory payload) internal {
        // This method on this contract does not have enough access to execute this, it should be executed on the
        // upgradable contract.
        upgradeUpgradableContract(payload);
    }

    function upgradeUpgradableContract(
        UpgradeContractPayload memory payload
    ) internal virtual;
}
