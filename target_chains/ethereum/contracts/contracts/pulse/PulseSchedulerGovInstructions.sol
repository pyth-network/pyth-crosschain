// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "../pyth/PythGovernanceInstructions.sol";
import "./SchedulerUpgradeable.sol";

/**
 * @dev `PulseSchedulerGovInstructions` handles governance instructions for the Pulse Scheduler contract.
 * Initially, it only supports the upgrade contract instruction.
 */
contract PulseSchedulerGovInstructions {
    // Instance of PythGovernanceInstructions for parsing payloads
    PythGovernanceInstructions private pythGov;
    
    constructor() {
        pythGov = new PythGovernanceInstructions();
    }
    
    /**
     * @dev Processes a governance instruction for the Pulse Scheduler contract.
     * @param instruction The governance instruction to process.
     * @param scheduler The Pulse Scheduler contract to apply the instruction to.
     */
    function processInstruction(
        PythGovernanceInstructions.GovernanceInstruction memory instruction,
        SchedulerUpgradeable scheduler
    ) external {
        // Only the admin can process governance instructions
        if (msg.sender != scheduler.getAdmin()) {
            revert("Unauthorized");
        }

        // Currently only supports the upgrade contract instruction
        if (instruction.action != PythGovernanceInstructions.GovernanceAction.UpgradeContract) {
            revert("Unsupported governance action");
        }

        // Parse the upgrade contract payload
        PythGovernanceInstructions.UpgradeContractPayload memory payload = 
            pythGov.parseUpgradeContractPayload(instruction.payload);

        // Upgrade the contract
        scheduler.upgradeTo(payload.newImplementation);
    }
}
