// contracts/Governance.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythGovernanceEvents.sol";
import "./PythGovernanceInstructions.sol";
import "./PythGovernanceModule.sol";
import "./PythInternalStructs.sol";
import "./PythGetters.sol";
import "./PythSetters.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Pyth contract.
 *
 * Only VAA verification, instruction parsing and the `UpgradeContract` action are
 * handled here. Every other action is delegated to the `PythGovernanceModule`
 * library, which is deployed separately and linked into this contract, so that the
 * implementation stays below the EIP-170 code size limit.
 *
 * `UpgradeContract` stays inline on purpose. This function is the only working
 * upgrade path — ownership is renounced in `PythUpgradable.initialize`, so
 * `_authorizeUpgrade` always reverts — and routing it through a linked library
 * would make an undeployed or mis-linked library permanently unrecoverable.
 */
abstract contract PythGovernance is
    PythGetters,
    PythSetters,
    PythGovernanceInstructions,
    IPythGovernanceEvents
{
    function verifyGovernanceVM(
        bytes memory encodedVM
    ) internal returns (IWormhole.VM memory parsedVM) {
        (IWormhole.VM memory vm, bool valid, ) = wormhole().parseAndVerifyVM(
            encodedVM
        );

        if (!valid) revert PythErrors.InvalidWormholeVaa();

        if (!isValidGovernanceDataSource(vm.emitterChainId, vm.emitterAddress))
            revert PythErrors.InvalidGovernanceDataSource();

        if (vm.sequence <= lastExecutedGovernanceSequence())
            revert PythErrors.OldGovernanceMessage();

        setLastExecutedGovernanceSequence(vm.sequence);

        return vm;
    }

    function executeGovernanceInstruction(bytes calldata encodedVM) public {
        IWormhole.VM memory vm = verifyGovernanceVM(encodedVM);

        GovernanceInstruction memory gi = parseGovernanceInstruction(
            vm.payload
        );

        if (gi.targetChainId != chainId() && gi.targetChainId != 0)
            revert PythErrors.InvalidGovernanceTarget();

        if (gi.action == GovernanceAction.UpgradeContract) {
            if (gi.targetChainId == 0)
                revert PythErrors.InvalidGovernanceTarget();
            upgradeContract(parseUpgradeContractPayload(gi.payload));
        } else {
            // The already-parsed instruction is forwarded instead of the raw
            // `msg.data`: `verifyGovernanceVM` above has already advanced
            // `lastExecutedGovernanceSequence` to `vm.sequence`, so re-verifying
            // the VAA inside the library would revert with `OldGovernanceMessage`.
            // `encodedVM` is still passed along because `SetWormholeAddress` has
            // to re-parse it with the newly set wormhole contract.
            PythGovernanceModule.executeGovernanceAction(_state, gi, encodedVM);
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
