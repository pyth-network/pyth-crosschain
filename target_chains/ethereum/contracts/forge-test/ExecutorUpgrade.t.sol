// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "../contracts/executor/ExecutorUpgradable.sol";
import "../contracts/executor/ExecutorErrors.sol";
import "./utils/WormholeTestUtils.t.sol";

contract ExecutorTest is Test, WormholeTestUtils {
    Wormhole public wormhole;

    ExecutorUpgradable public executor;
    ExecutorUpgradable public executor2;

    uint16 OWNER_CHAIN_ID = 7;
    bytes32 OWNER_EMITTER = bytes32(uint256(1));

    uint8 NUM_SIGNERS = 1;

    function setUp() public {
        address _wormhole = setUpWormholeReceiver(NUM_SIGNERS);
        ExecutorUpgradable _executor = new ExecutorUpgradable();
        executor2 = new ExecutorUpgradable();

        ERC1967Proxy _proxy = new ERC1967Proxy(address(_executor), "");
        executor = ExecutorUpgradable(payable(address(_proxy)));

        executor.initialize(
            _wormhole,
            0,
            CHAIN_ID,
            OWNER_CHAIN_ID,
            OWNER_EMITTER
        );
    }

    function getUpgradeContractVaa(
        uint64 sequence,
        uint16 chainId
    ) internal returns (bytes memory vaa) {
        bytes memory payload = abi.encodePacked(
            uint32(0x5054474d),
            PythGovernanceInstructions.GovernanceModule.EvmExecutor,
            Executor.ExecutorAction.UpgradeContract,
            chainId,
            address(executor2)
        );

        vaa = generateVaa(
            uint32(block.timestamp),
            OWNER_CHAIN_ID,
            OWNER_EMITTER,
            sequence,
            payload,
            NUM_SIGNERS
        );
    }

    function testCallSucceeds() public {
        executor.executeGovernanceInstruction(
            getUpgradeContractVaa(1, CHAIN_ID)
        );
    }

    function testCallFailsForChainIdZero() public {
        bytes memory vaa = getUpgradeContractVaa(1, 0);
        vm.expectRevert();
        executor.executeGovernanceInstruction(vaa);
    }
}
