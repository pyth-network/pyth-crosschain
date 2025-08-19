// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// --- Script Purpose ---
// This script transfers ownership of the deployed PythLazer contract (proxy) to a new owner contract (typically the governance executor contract).
// Usage: Run this script after deploying the new executor contract on the target chain. Ensure the executor address is correct and deployed.
// Preconditions:
//   - The LAZER_PROXY_ADDRESS must point to the deployed PythLazer proxy contract. Currently set to 0xACeA761c27A909d4D3895128EBe6370FDE2dF481, which was made using createX.
//   - The NEW_OWNER must be the deployed executor contract address on this chain.
//   - The script must be run by the current owner (OLD_OWNER) of the PythLazer contract.
//   - The DEPLOYER_PRIVATE_KEY environment variable must be set to the current owner's private key.
//
// Steps:
//   1. Log current and new owner addresses, and the proxy address.
//   2. Check the current owner matches the expected OLD_OWNER.
//   3. Transfer ownership to the NEW_OWNER (executor contract).
//   4. Log the new owner for verification.
//
// Note: This script is intended for use with Foundry (forge-std) tooling.

import {Script, console} from "forge-std/Script.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// Main script contract for ownership transfer
contract PythLazerChangeOwnership is Script {
    // Address of the deployed PythLazer proxy contract
    address public constant LAZER_PROXY_ADDRESS =
        address(0xACeA761c27A909d4D3895128EBe6370FDE2dF481);

    // Private key of the current owner, loaded from environment variable
    uint256 public OLD_OWNER_PRIVATE_KEY = vm.envUint("PK");
    // Current owner address, derived from private key
    address public OLD_OWNER = vm.addr(OLD_OWNER_PRIVATE_KEY);
    // Address of the new owner (should be the deployed executor contract)
    address public NEW_OWNER = vm.envAddress("NEW_OWNER");

    // Entry point for the script
    function run() public {
        // Log relevant addresses for traceability
        console.log("Old owner: %s", OLD_OWNER);
        console.log("New owner: %s", NEW_OWNER);
        console.log("Lazer proxy address: %s", LAZER_PROXY_ADDRESS);
        console.log("Lazer owner: %s", PythLazer(LAZER_PROXY_ADDRESS).owner());
        console.log("Moving ownership from %s to %s", OLD_OWNER, NEW_OWNER);

        // Get the PythLazer contract instance at the proxy address
        PythLazer lazer = PythLazer(LAZER_PROXY_ADDRESS);

        // Start broadcasting transactions as the old owner
        vm.startBroadcast(OLD_OWNER_PRIVATE_KEY);

        // Ensure the current owner matches the expected old owner
        require(lazer.owner() == OLD_OWNER, "Old owner mismatch");

        // Transfer ownership to the new owner (executor contract)
        lazer.transferOwnership(NEW_OWNER);
        console.log("Ownership transferred");

        // Log the new owner for verification
        console.log(
            "New Lazer owner: %s",
            PythLazer(LAZER_PROXY_ADDRESS).owner()
        );

        // Stop broadcasting
        vm.stopBroadcast();
    }
}
