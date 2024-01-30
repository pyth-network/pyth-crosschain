// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "./Executor.sol";
import "./ExecutorErrors.sol";

contract ExecutorUpgradable is
    Initializable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Executor
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    function initialize(
        address wormhole,
        uint64 lastExecutedSequence,
        uint16 chainId,
        uint16 ownerEmitterChainId,
        bytes32 ownerEmitterAddress
    ) public initializer {
        require(wormhole != address(0), "wormhole is zero address");

        __Ownable_init();
        __UUPSUpgradeable_init();

        Executor._initialize(
            wormhole,
            lastExecutedSequence,
            chainId,
            ownerEmitterChainId,
            ownerEmitterAddress
        );

        // Transfer ownership to the contract itself.
        _transferOwnership(address(this));
    }

    /// Ensures the contract cannot be uninitialized and taken over.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Only allow the owner to upgrade the proxy to a new implementation.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // Upgrade the contract to the given newImplementation. The `newImplementation`
    // should implement the method  `entropyUpgradableMagic`, see below. If the method
    // is not implemented or if the magic is different from the current contract, this call
    // will revert.
    function upgradeTo(address newImplementation) external override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);

        magicCheck();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    // Upgrade the contract to the given newImplementation and call it with the given data.
    // The `newImplementation` should implement the method  `entropyUpgradableMagic`, see
    // below. If the method is not implemented or if the magic is different from the current
    // contract, this call will revert.
    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);

        magicCheck();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    function magicCheck() internal view {
        // Calling a method using `this.<method>` will cause a contract call that will use
        // the new contract. This call will fail if the method does not exists or the magic
        // is different.
        if (this.entropyUpgradableMagic() != 0x66697288)
            revert ExecutorErrors.InvalidMagicValue();
    }

    function entropyUpgradableMagic() public pure returns (uint32) {
        return 0x66697288;
    }

    function version() public pure returns (string memory) {
        return "0.1.1";
    }
}
