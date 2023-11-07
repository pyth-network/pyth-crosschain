// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "../contracts/executor/Executor.sol";
import "./utils/WormholeTestUtils.t.sol";

contract ExecutorTest is Test, WormholeTestUtils {
    Wormhole public wormhole;
    Executor public executor;

    // uint16 CHAIN_ID = 1;
    uint16 OWNER_CHAIN_ID = 7;
    bytes32 OWNER_EMITTER = bytes32(uint256(1));

    uint8 NUM_SIGNERS = 1;

    function setUp() public {
        address _wormhole = setUpWormholeReceiver(NUM_SIGNERS);
        executor = new Executor(
          _wormhole,
          0,
          CHAIN_ID,
            OWNER_CHAIN_ID,
          OWNER_EMITTER
        );
    }

    function testExecute(
       address callAddress,
     bytes callData,
uint64 sequence
    ) internal returns (bytes memory vaa) {
        bytes memory payload = abi.encodePacked(
           uint32(0x5054474d),
           PythGovernanceInstructions.GovernanceModule.EvmExecutor,
           0,
            CHAIN_ID,
            address(executor),
            callAddress,
            callData
        );

        vaa = generateVaa(
            uint32(block.timestamp),
            // TODO: make these arguments
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            sequence,
            payload,
            NUM_SIGNERS
        );
    }

    function testBasic() public {
        testExecute(address(this), abi.encodeCall(foo.selector))
    }

    function foo() {

    }

    /*
    function testGetFee() public {
        assertEq(random.getFee(provider1), pythFeeInWei + provider1FeeInWei);
        assertEq(random.getFee(provider2), pythFeeInWei + provider2FeeInWei);
        // Requesting the fee for a nonexistent provider returns pythFeeInWei. This isn't necessarily desirable behavior,
        // but it's unlikely to cause a problem.
        assertEq(random.getFee(unregisteredProvider), pythFeeInWei);

        // Check that overflowing the fee arithmetic causes the transaction to revert.
        vm.prank(provider1);
        random.register(
            MAX_UINT256,
            provider1Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            100
        );
        vm.expectRevert();
        random.getFee(provider1);
    }

    function testFees() public {
        // Insufficient fees causes a revert
        assertRequestReverts(0, provider1, 42, false);
        assertRequestReverts(
            pythFeeInWei + provider1FeeInWei - 1,
            provider1,
            42,
            false
        );
        assertRequestReverts(0, provider2, 42, false);
        assertRequestReverts(
            pythFeeInWei + provider2FeeInWei - 1,
            provider2,
            42,
            false
        );

        // Accrue some fees for both providers
        for (uint i = 0; i < 3; i++) {
            request(user2, provider1, 42, false);
        }

        request(user2, provider2, 42, false);
        // this call overpays for the random number
        requestWithFee(
            user2,
            pythFeeInWei + provider2FeeInWei + 10000,
            provider2,
            42,
            false
        );

        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            provider1FeeInWei * 3
        );
        assertEq(
            random.getProviderInfo(provider2).accruedFeesInWei,
            provider2FeeInWei * 2
        );
        assertEq(random.getAccruedPythFees(), pythFeeInWei * 5 + 10000);
        assertInvariants();

        // Reregistering updates the required fees
        vm.prank(provider1);
        random.register(
            12345,
            provider1Proofs[0],
            bytes32(keccak256(abi.encodePacked(uint256(0x0100)))),
            100
        );

        assertRequestReverts(pythFeeInWei + 12345 - 1, provider1, 42, false);
        requestWithFee(user2, pythFeeInWei + 12345, provider1, 42, false);

        uint providerOneBalance = provider1FeeInWei * 3 + 12345;
        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            providerOneBalance
        );
        assertInvariants();

        vm.prank(unregisteredProvider);
        vm.expectRevert();
        random.withdraw(1000);

        vm.prank(provider1);
        random.withdraw(1000);

        assertEq(
            random.getProviderInfo(provider1).accruedFeesInWei,
            providerOneBalance - 1000
        );
        assertInvariants();

        vm.prank(provider1);
        vm.expectRevert();
        random.withdraw(providerOneBalance);
    }
*/
}
