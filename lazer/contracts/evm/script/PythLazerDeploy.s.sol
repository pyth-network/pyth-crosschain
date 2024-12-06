// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {PythLazer} from "../src/PythLazer.sol";
import {ICreateX} from "createx/ICreateX.sol";
import {CreateX} from "createx/CreateX.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

// This script deploys the PythLazer proxy and implementation contract using
// CreateX's contract factory to a deterministic address. Having deterministic
// addresses make it easier for users to access our contracts and also helps in
// making this deployment script idempotent without maintaining any state.
//
// CreateX enables us to deploy the contract deterministically to the same
// address on any EVM chain using various methods. We use the deployer address
// in salt to protect the deployment addresses from being redeployed by other
// wallets so the addresses we use be fully deterministic. We use `create2` to
// deploy the implementation contracts (to have a single address per
// implementation) and `create3` to deploy the proxies (to avoid changing
// addresses if our proxy contract changes, which might sound impossible, but
// can easily happen when you change the optimisation or the solc version!).
// Below you will find more explanation on what these methods.
//
// a `create` opcode (which typical deployment uses) on the EVM would deploy a
// contract to an address that is a hash of the caller address, and the tx
// nonce. Nonce is the tx number and can't be set and therefore it's not easily
// possible to achieve deterministic deployments (unless we somehow make sure
// the deployer never sends transactions prior deployment). That's why there is
// a `create2` opcode that allows us to deploy contracts to an address that is
// a hash of the caller address, a salt, and the contract bytecode. The salt is
// a random number that we can control and therefore we can deploy contracts
// deterministically. The problem with `create2` is that it is the bytecode
// affects the address and therefore we can't deploy different contracts to the
// same address. That's where the idea of `create3` comes in. `create3` is a
// wrapper around create2 and create that achieves it. It deploys a minimal
// fixed-code proxy first using create2 (which will be in a deterministic
// address) and then we call the proxy using the new contract code. The proxy
// then calls `create` to deploy the new contract and since it's the first
// transaction of the proxy the nonce will be 0 and the address will be
// deterministic.
//
// Maybe you are wondering why factory contracts are needed. We need them to
// call create2 and since the caller address matters we need a factory contract
// at a fixed address and that's what CreateX is for. CreateX has a single
// signed transaction to deploy it in any network (and hopefully the key that
// it uses is destroyed!).
contract PythLazerDeployScript is Script {
    // The address of the wallet calling this script. This is used to protect
    // the deployment addresses from being redeployed by other wallets.
    address constant deployer = 0x78357316239040e19fC823372cC179ca75e64b81;

    // CreateX is a Contract Factory that provides multiple deployment solutions that
    // we use for deterministic deployments of our contract. It is universally deployed
    // at this address and can be deployed if it is not already deployed.
    ICreateX constant createX =
        ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

    function contractDeployed(address addr) public view returns (bool) {
        return addr.code.length > 0;
    }

    function setUp() public view {
        if (!contractDeployed(address(createX))) {
            revert(
                "CreateX not deployed. Deploy it following the instructions in https://github.com/pcaversaccio/createx"
            );
        }
    }

    // Generate a salt that is safeguarded against redeployments by other
    // deployers. CreateX has a safeguard mechanism that based on the following
    // salt format creates a guardedSalt that no one else can get to.
    //
    // @param seed: A random number to be used as the salt for deployment
    function generateSalt(
        bytes11 seed
    ) public pure returns (bytes32 salt, bytes32 guardedSalt) {
        salt = bytes32(
            abi.encodePacked(
                deployer, // Deployment protection by our deployer
                uint8(0), // No crosschain replay protection
                seed
            )
        );

        // Mimic CreateX's guardedSalt mechanism only for our type of salt. Couldn't use CreateX's
        // _guard function because it is internal and inheriting it results in conflict with Script.
        guardedSalt = keccak256(
            abi.encode(bytes32(uint256(uint160(deployer))), salt)
        );
    }

    // Deploy the implementation of the contract. This script is idempotent and
    // will return if the implementation is already deployed.
    //
    // @param seed: A random number to be used as the salt for deployment
    function deployImplementation(bytes11 seed) public returns (address addr) {
        (bytes32 salt, bytes32 guardedSalt) = generateSalt(seed);
        address implAddr = createX.computeCreate2Address({
            salt: guardedSalt,
            initCodeHash: keccak256(
                abi.encodePacked(type(PythLazer).creationCode)
            )
        });

        if (contractDeployed(implAddr)) {
            console.log("Implementation already deployed at: %s", implAddr);
            return implAddr;
        }

        console.log("Deploying implementation... %s", implAddr);

        vm.startBroadcast();
        addr = createX.deployCreate2({
            salt: salt,
            initCode: abi.encodePacked(type(PythLazer).creationCode)
        });
        vm.stopBroadcast();

        console.log("Deployed implementation to: %s", addr);

        require(
            addr == implAddr,
            "Implementation address mismatch due to mismatched deployer."
        );

        return addr;
    }

    function deployProxy(
        bytes11 seed,
        address impl
    ) public returns (address addr) {
        (bytes32 salt, bytes32 guardedSalt) = generateSalt(seed);
        address proxyAddr = createX.computeCreate3Address({salt: guardedSalt});

        if (contractDeployed(proxyAddr)) {
            console.log("Proxy already deployed at: %s", proxyAddr);
            return proxyAddr;
        }

        console.log("Deploying proxy... %s", proxyAddr);

        // Set the top authority to the deployer for the time being
        address topAuthority = deployer;

        vm.startBroadcast();
        addr = createX.deployCreate3({
            salt: salt,
            initCode: abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(
                    impl,
                    abi.encodeWithSignature("initialize(address)", topAuthority)
                )
            )
        });
        vm.stopBroadcast();

        console.log("Deployed proxy to: %s", addr);

        require(
            addr == proxyAddr,
            "Proxy address mismatch due to mismatched deployer."
        );

        return addr;
    }

    function getProxyAddress(bytes11 seed) public view returns (address addr) {
        (, bytes32 guardedSalt) = generateSalt(seed);
        address proxyAddr = createX.computeCreate3Address({salt: guardedSalt});
        return proxyAddr;
    }

    function run() public {
        address impl = deployImplementation("lazer:impl");
        deployProxy("lazer:proxy", impl);
    }

    function migrate() public {
        // Deploys new version and updates proxy to use new address
        address proxyAddress = getProxyAddress("lazer:proxy");
        address newImpl = deployImplementation("lazer:impl");
        bytes memory migrateCall = abi.encodeWithSignature("migrate()");
        vm.startBroadcast();
        UUPSUpgradeable proxy = UUPSUpgradeable(proxyAddress);
        proxy.upgradeToAndCall(newImpl, migrateCall);
        vm.stopBroadcast();
    }
}
