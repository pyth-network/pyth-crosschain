// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Wormhole contracts
import "../contracts/wormhole/Setup.sol";
import "../contracts/wormhole/Implementation.sol";
import "../contracts/wormhole/Wormhole.sol";

// Pyth contracts
import "../contracts/pyth/PythUpgradable.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Wormhole first
        address wormholeAddress = deployWormhole();
        console.log("Wormhole deployed at:", wormholeAddress);

        // Deploy Pyth
        address pythAddress = deployPyth(wormholeAddress);
        console.log("Pyth deployed at:", pythAddress);

        vm.stopBroadcast();
    }

    function deployWormhole() internal returns (address) {
        // Read environment variables
        address[] memory initialSigners = vm.envAddress("INIT_SIGNERS", ",");
        uint16 chainId = uint16(vm.envUint("INIT_CHAIN_ID"));
        uint16 governanceChainId = uint16(vm.envUint("INIT_GOV_CHAIN_ID"));
        bytes32 governanceContract = vm.envBytes32("INIT_GOV_CONTRACT");

        console.log("Deploying Wormhole with chainId:", chainId);
        console.log("Governance chainId:", governanceChainId);

        // Deploy Setup contract
        Setup setup = new Setup();
        console.log("Setup deployed at:", address(setup));

        // Deploy Implementation contract
        Implementation implementation = new Implementation();
        console.log("Implementation deployed at:", address(implementation));

        // Encode initialization data
        bytes memory initData = abi.encodeWithSignature(
            "setup(address,address[],uint16,uint16,bytes32)",
            address(implementation),
            initialSigners,
            chainId,
            governanceChainId,
            governanceContract
        );

        // Deploy Wormhole proxy
        Wormhole wormhole = new Wormhole(address(setup), initData);

        return address(wormhole);
    }

    function deployPyth(address wormholeAddress) internal returns (address) {
        // Read environment variables
        uint16 pyth2WormholeChainId = uint16(vm.envUint("SOLANA_CHAIN_ID"));
        bytes32 pyth2WormholeEmitter = vm.envBytes32("SOLANA_EMITTER");
        uint16 governanceChainId = uint16(vm.envUint("GOVERNANCE_CHAIN_ID"));
        bytes32 governanceEmitter = vm.envBytes32("GOVERNANCE_EMITTER");
        uint64 governanceInitialSequence = uint64(
            vm.envOr("GOVERNANCE_INITIAL_SEQUENCE", uint256(0))
        );
        uint256 validTimePeriodSeconds = vm.envUint(
            "VALID_TIME_PERIOD_SECONDS"
        );
        uint256 singleUpdateFeeInWei = vm.envUint("SINGLE_UPDATE_FEE_IN_WEI");

        console.log("pyth2WormholeChainId:", pyth2WormholeChainId);
        console.log("pyth2WormholeEmitter:", uint256(pyth2WormholeEmitter));
        console.log("governanceEmitter:", uint256(governanceEmitter));
        console.log("governanceChainId:", governanceChainId);
        console.log("governanceInitialSequence:", governanceInitialSequence);
        console.log("validTimePeriodSeconds:", validTimePeriodSeconds);
        console.log("singleUpdateFeeInWei:", singleUpdateFeeInWei);

        // Deploy PythUpgradable implementation
        PythUpgradable pythImpl = new PythUpgradable();
        console.log(
            "PythUpgradable implementation deployed at:",
            address(pythImpl)
        );

        // Prepare initialization data
        uint16[] memory dataSourceChainIds = new uint16[](1);
        dataSourceChainIds[0] = pyth2WormholeChainId;

        bytes32[] memory dataSourceEmitterAddresses = new bytes32[](1);
        dataSourceEmitterAddresses[0] = pyth2WormholeEmitter;

        bytes memory pythInitData = abi.encodeWithSignature(
            "initialize(address,uint16[],bytes32[],uint16,bytes32,uint64,uint256,uint256)",
            wormholeAddress,
            dataSourceChainIds,
            dataSourceEmitterAddresses,
            governanceChainId,
            governanceEmitter,
            governanceInitialSequence,
            validTimePeriodSeconds,
            singleUpdateFeeInWei
        );

        // Deploy ERC1967 proxy
        ERC1967Proxy pythProxy = new ERC1967Proxy(
            address(pythImpl),
            pythInitData
        );

        return address(pythProxy);
    }
}
