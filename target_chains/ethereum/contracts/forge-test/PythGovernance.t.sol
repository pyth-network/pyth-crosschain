// SPDX-License-Identifier: Apache 2

// NOTE: These tests were migrated from target_chains/ethereum/contracts/test/pyth.js but exclude the Wormhole-specific tests,
// which remain in the original JavaScript test file.

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "../contracts/pyth/PythInternalStructs.sol";
import "../contracts/pyth/PythGovernanceInstructions.sol";
import "../contracts/pyth/PythUpgradable.sol";
import "../contracts/pyth/PythGetters.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../contracts/wormhole/interfaces/IWormhole.sol";
import "../contracts/wormhole/Implementation.sol";
import "../contracts/wormhole/Setup.sol";
import "../contracts/wormhole/Wormhole.sol";
import "../contracts/wormhole-receiver/WormholeReceiver.sol";
import "../contracts/wormhole-receiver/ReceiverImplementation.sol";
import "../contracts/wormhole-receiver/ReceiverSetup.sol";
import "../contracts/wormhole-receiver/ReceiverGovernanceStructs.sol";
import "../contracts/wormhole-receiver/ReceiverStructs.sol";
import "../contracts/wormhole-receiver/ReceiverGovernance.sol";
import "../contracts/libraries/external/BytesLib.sol";
import "../contracts/pyth/mock/MockUpgradeableProxy.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";

contract PythGovernanceTest is
    Test,
    WormholeTestUtils,
    PythTestUtils,
    PythGovernanceInstructions
{
    using BytesLib for bytes;

    IPyth public pyth;
    address constant TEST_SIGNER1 = 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe;
    address constant TEST_SIGNER2 = 0x4ba0C2db9A26208b3bB1a50B01b16941c10D76db;
    uint16 constant TEST_GOVERNANCE_CHAIN_ID = 1;
    bytes32 constant TEST_GOVERNANCE_EMITTER =
        0x0000000000000000000000000000000000000000000000000000000000000011;
    uint16 constant TEST_PYTH2_WORMHOLE_CHAIN_ID = 1;
    bytes32 constant TEST_PYTH2_WORMHOLE_EMITTER =
        0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b;
    uint16 constant TARGET_CHAIN_ID = 2;

    function setUp() public {
        pyth = IPyth(setUpPyth(setUpWormholeReceiver(1)));
    }

    function testNoOwner() public {
        // Check that the ownership is renounced
        assertEq(OwnableUpgradeable(address(pyth)).owner(), address(0));
    }

    function testValidDataSources() public {
        assertTrue(
            PythGetters(address(pyth)).isValidDataSource(
                TEST_PYTH2_WORMHOLE_CHAIN_ID,
                TEST_PYTH2_WORMHOLE_EMITTER
            )
        );
    }

    function testSetFee() public {
        // Set fee to 5000 (5000 = 5 * 10^3)
        bytes memory setFeeMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetFee),
            TARGET_CHAIN_ID,
            uint64(5), // value
            uint64(3) // exponent
        );

        bytes memory vaa = encodeAndSignMessage(
            setFeeMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        uint oldFee = PythGetters(address(pyth)).singleUpdateFeeInWei();
        vm.expectEmit(true, true, true, true);
        emit FeeSet(oldFee, 5000);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
        assertEq(PythGetters(address(pyth)).singleUpdateFeeInWei(), 5000);
    }

    function testSetValidPeriod() public {
        // Create governance VAA to set valid period to 0
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            TARGET_CHAIN_ID, // Target chain ID
            uint64(0) // New valid period
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        uint oldValidPeriod = PythGetters(address(pyth))
            .validTimePeriodSeconds();
        vm.expectEmit(true, true, true, true);
        emit ValidPeriodSet(oldValidPeriod, 0);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
        assertEq(PythGetters(address(pyth)).validTimePeriodSeconds(), 0);
    }

    function testInvalidGovernanceMessage() public {
        // Test with wrong magic number
        bytes memory data = abi.encodePacked(
            bytes4(0x12345678), // Wrong magic
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            uint16(1), // Target chain ID
            uint64(0)
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        vm.expectRevert(PythErrors.InvalidGovernanceMessage.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    function testInvalidGovernanceTarget() public {
        // Test with wrong chain target
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            uint16(3), // Different chain ID for testing invalid target
            uint64(0)
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        vm.expectRevert(PythErrors.InvalidGovernanceTarget.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    function testInvalidGovernanceDataSource() public {
        // Test with wrong emitter
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            TARGET_CHAIN_ID,
            uint64(0)
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            bytes32(uint256(0x1111)), // Wrong emitter
            1
        );

        vm.expectRevert(PythErrors.InvalidGovernanceDataSource.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    function testSetDataSources() public {
        // Create governance VAA to set new data sources
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetDataSources),
            TARGET_CHAIN_ID, // Target chain ID
            uint8(1), // Number of data sources
            uint16(1), // Chain ID
            bytes32(
                0x0000000000000000000000000000000000000000000000000000000000001111
            ) // Emitter
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        PythInternalStructs.DataSource[] memory oldDataSources = PythGetters(
            address(pyth)
        ).validDataSources();

        PythInternalStructs.DataSource[]
            memory newDataSources = new PythInternalStructs.DataSource[](1);
        newDataSources[0] = PythInternalStructs.DataSource(
            1,
            0x0000000000000000000000000000000000000000000000000000000000001111
        );

        vm.expectEmit(true, true, true, true);
        emit DataSourcesSet(oldDataSources, newDataSources);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);

        // Verify old data source is no longer valid
        assertFalse(
            PythGetters(address(pyth)).isValidDataSource(
                TEST_PYTH2_WORMHOLE_CHAIN_ID,
                TEST_PYTH2_WORMHOLE_EMITTER
            )
        );

        // Verify new data source is valid
        assertTrue(
            PythGetters(address(pyth)).isValidDataSource(
                1,
                0x0000000000000000000000000000000000000000000000000000000000001111
            )
        );
    }

    function testSetWormholeAddress() public {
        // Deploy a new wormhole contract
        address newWormhole = address(setUpWormholeReceiver(1));

        // Create governance VAA to set new wormhole address
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetWormholeAddress),
            TARGET_CHAIN_ID, // Target chain ID
            newWormhole // New wormhole address
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        address oldWormhole = address(PythGetters(address(pyth)).wormhole());
        vm.expectEmit(true, true, true, true);
        emit WormholeAddressSet(oldWormhole, newWormhole);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
        assertEq(address(PythGetters(address(pyth)).wormhole()), newWormhole);
    }

    function testTransferGovernanceDataSource() public {
        uint16 newEmitterChain = 2;
        bytes32 newEmitterAddress = 0x0000000000000000000000000000000000000000000000000000000000001111;

        // Create claim VAA from new governance
        bytes memory claimData = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.RequestGovernanceDataSourceTransfer),
            TARGET_CHAIN_ID, // Target chain ID
            uint32(1) // New governance index
        );

        bytes memory claimVaa = encodeAndSignMessage(
            claimData,
            newEmitterChain,
            newEmitterAddress,
            1
        );

        // Create authorize VAA from current governance
        bytes memory authData = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.AuthorizeGovernanceDataSourceTransfer),
            TARGET_CHAIN_ID, // Target chain ID
            claimVaa
        );

        bytes memory authVaa = encodeAndSignMessage(
            authData,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        PythInternalStructs.DataSource
            memory oldDataSource = PythInternalStructs.DataSource(
                TEST_GOVERNANCE_CHAIN_ID,
                TEST_GOVERNANCE_EMITTER
            );
        PythInternalStructs.DataSource
            memory newDataSource = PythInternalStructs.DataSource(
                newEmitterChain,
                newEmitterAddress
            );

        vm.expectEmit(true, true, true, true);
        emit GovernanceDataSourceSet(oldDataSource, newDataSource, 1);

        PythGovernance(address(pyth)).executeGovernanceInstruction(authVaa);

        // Verify old governance can't execute instructions anymore
        bytes memory invalidData = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            uint16(1), // Wrong chain ID for testing invalid target
            uint64(0)
        );

        bytes memory invalidVaa = encodeAndSignMessage(
            invalidData,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            2
        );

        vm.expectRevert(PythErrors.InvalidGovernanceDataSource.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(invalidVaa);
    }

    function testSequentialGovernanceMessages() public {
        // First governance message
        bytes memory data1 = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            TARGET_CHAIN_ID, // Target chain ID
            uint64(10)
        );

        bytes memory vaa1 = encodeAndSignMessage(
            data1,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa1);

        // Second governance message
        bytes memory data2 = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetValidPeriod),
            TARGET_CHAIN_ID, // Target chain ID
            uint64(20)
        );

        bytes memory vaa2 = encodeAndSignMessage(
            data2,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            2
        );

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa2);

        // Try to replay first message
        vm.expectRevert(PythErrors.OldGovernanceMessage.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa1);

        // Try to replay second message
        vm.expectRevert(PythErrors.OldGovernanceMessage.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa2);
    }

    function testUpgradeContractWithChainIdZeroIsInvalid() public {
        // Deploy a new PythUpgradable contract
        PythUpgradable newImplementation = new PythUpgradable();

        // Create governance VAA with chain ID 0 (unset)
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.UpgradeContract),
            uint16(0), // Chain ID 0 (unset)
            address(newImplementation) // New implementation address
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        // Should revert with InvalidGovernanceTarget
        vm.expectRevert(PythErrors.InvalidGovernanceTarget.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    // Helper function to get the second address from event data
    function getSecondAddressFromEventData(
        bytes memory data
    ) internal pure returns (address) {
        (, address secondAddr) = abi.decode(data, (address, address));
        return secondAddr;
    }

    function testUpgradeContractShouldWork() public {
        // Deploy a new PythUpgradable contract
        PythUpgradable newImplementation = new PythUpgradable();

        // Create governance VAA to upgrade the contract
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.UpgradeContract),
            TARGET_CHAIN_ID, // Valid target chain ID
            address(newImplementation) // New implementation address
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        // Create a custom event checker for ContractUpgraded event
        // Since we only care about the newImplementation parameter
        vm.recordLogs();

        // Execute the governance instruction
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);

        // Get emitted logs and check the event parameters
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool foundUpgradeEvent = false;

        for (uint i = 0; i < entries.length; i++) {
            // The event signature for ContractUpgraded
            bytes32 eventSignature = keccak256(
                "ContractUpgraded(address,address)"
            );

            if (entries[i].topics[0] == eventSignature) {
                // This is a ContractUpgraded event
                // Get just the new implementation address using our helper
                address recordedNewImplementation = getSecondAddressFromEventData(
                        entries[i].data
                    );

                // Check newImplementation
                assertEq(recordedNewImplementation, address(newImplementation));
                foundUpgradeEvent = true;
                break;
            }
        }

        // Make sure we found the event
        assertTrue(foundUpgradeEvent, "ContractUpgraded event not found");

        // Verify the upgrade worked by checking the magic number
        assertEq(
            PythUpgradable(address(pyth)).pythUpgradableMagic(),
            0x97a6f304
        );

        // Verify the implementation was upgraded to our new implementation
        // Access implementation using the ERC1967 storage slot
        address implAddr = address(
            uint160(
                uint256(
                    vm.load(
                        address(pyth),
                        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc // ERC1967 implementation slot
                    )
                )
            )
        );
        assertEq(implAddr, address(newImplementation));
    }

    function testUpgradeContractToNonPythContractWontWork() public {
        // Deploy a mock upgradeable proxy that isn't a proper Pyth implementation
        MockUpgradeableProxy newImplementation = new MockUpgradeableProxy();

        // Create governance VAA to upgrade to an invalid implementation
        bytes memory data = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.UpgradeContract),
            TARGET_CHAIN_ID, // Valid target chain ID
            address(newImplementation) // Invalid implementation address
        );

        bytes memory vaa = encodeAndSignMessage(
            data,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        // Should revert with no specific error message because the mock implementation
        // doesn't have the pythUpgradableMagic method
        vm.expectRevert();
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    function testSetTransactionFee() public {
        // Set transaction fee to 1000 (1000 = 1 * 10^3)
        bytes memory setTransactionFeeMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.SetTransactionFee),
            TARGET_CHAIN_ID,
            uint64(1), // value
            uint64(3) // exponent
        );

        bytes memory vaa = encodeAndSignMessage(
            setTransactionFeeMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        uint oldFee = PythGetters(address(pyth)).transactionFeeInWei();
        vm.expectEmit(true, true, true, true);
        emit TransactionFeeSet(oldFee, 1000);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
        assertEq(PythGetters(address(pyth)).transactionFeeInWei(), 1000);

        // Test that update fee includes transaction fee
        bytes[] memory updateData = new bytes[](0);
        assertEq(pyth.getUpdateFee(updateData), 1000);

        // Test that insufficient fee reverts
        vm.expectRevert(PythErrors.InsufficientFee.selector);
        pyth.updatePriceFeeds{value: 999}(updateData);

        // Test that sufficient fee works
        pyth.updatePriceFeeds{value: 1000}(updateData);
    }

    function testWithdrawFee() public {
        // First send some ETH to the contract
        bytes[] memory updateData = new bytes[](0);
        pyth.updatePriceFeeds{value: 1 ether}(updateData);
        assertEq(address(pyth).balance, 1 ether);

        address recipient = makeAddr("recipient");

        // Create governance VAA to withdraw fee
        bytes memory withdrawMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.WithdrawFee),
            TARGET_CHAIN_ID,
            recipient,
            uint64(5), // value = 5
            uint64(17) // exponent = 17 (5 * 10^17 = 0.5 ether)
        );

        bytes memory vaa = encodeAndSignMessage(
            withdrawMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        vm.expectEmit(true, true, true, true);
        emit FeeWithdrawn(recipient, 0.5 ether);

        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);

        assertEq(address(pyth).balance, 0.5 ether);
        assertEq(recipient.balance, 0.5 ether);
    }

    function testWithdrawFeeInsufficientBalance() public {
        // First send some ETH to the contract
        bytes[] memory updateData = new bytes[](0);
        pyth.updatePriceFeeds{value: 1 ether}(updateData);
        assertEq(address(pyth).balance, 1 ether);

        address recipient = makeAddr("recipient");

        // Create governance VAA to withdraw fee
        bytes memory withdrawMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.WithdrawFee),
            TARGET_CHAIN_ID,
            recipient,
            uint64(2), // value = 2
            uint64(18) // exponent = 18 (2 * 10^18 = 2 ether, more than balance)
        );

        bytes memory vaa = encodeAndSignMessage(
            withdrawMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            TEST_GOVERNANCE_EMITTER,
            1
        );

        vm.expectRevert(PythErrors.InsufficientFee.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);

        // Balances should remain unchanged
        assertEq(address(pyth).balance, 1 ether);
        assertEq(recipient.balance, 0);
    }

    function testWithdrawFeeInvalidGovernance() public {
        address recipient = makeAddr("recipient");

        // Create governance VAA with wrong emitter
        bytes memory withdrawMessage = abi.encodePacked(
            MAGIC,
            uint8(GovernanceModule.Target),
            uint8(GovernanceAction.WithdrawFee),
            TARGET_CHAIN_ID,
            recipient,
            uint64(5), // value = 5
            uint64(17) // exponent = 17 (5 * 10^17 = 0.5 ether)
        );

        bytes memory vaa = encodeAndSignMessage(
            withdrawMessage,
            TEST_GOVERNANCE_CHAIN_ID,
            bytes32(uint256(0x1111)), // Wrong emitter
            1
        );

        vm.expectRevert(PythErrors.InvalidGovernanceDataSource.selector);
        PythGovernance(address(pyth)).executeGovernanceInstruction(vaa);
    }

    function encodeAndSignWormholeMessage(
        bytes memory data,
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence,
        uint8 numGuardians
    ) internal view returns (bytes memory) {
        return
            generateVaa(
                uint32(block.timestamp),
                emitterChainId,
                emitterAddress,
                sequence,
                data,
                numGuardians
            );
    }

    function encodeAndSignMessage(
        bytes memory data,
        uint16 emitterChainId,
        bytes32 emitterAddress,
        uint64 sequence
    ) internal view returns (bytes memory) {
        return
            encodeAndSignWormholeMessage(
                data,
                emitterChainId,
                emitterAddress,
                sequence,
                1 // Number of guardians
            );
    }

    // Events
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );
    event GovernanceDataSourceSet(
        PythInternalStructs.DataSource oldDataSource,
        PythInternalStructs.DataSource newDataSource,
        uint64 initialSequence
    );
    event DataSourcesSet(
        PythInternalStructs.DataSource[] oldDataSources,
        PythInternalStructs.DataSource[] newDataSources
    );
    event FeeSet(uint oldFee, uint newFee);
    event ValidPeriodSet(uint oldValidPeriod, uint newValidPeriod);
    event WormholeAddressSet(
        address oldWormholeAddress,
        address newWormholeAddress
    );
    event TransactionFeeSet(uint oldFee, uint newFee);
    event FeeWithdrawn(address recipient, uint256 fee);
}
