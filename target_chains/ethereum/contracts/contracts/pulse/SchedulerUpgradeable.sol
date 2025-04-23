// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "./Scheduler.sol";
import "./PulseSchedulerGovernance.sol";

contract SchedulerUpgradeable is
    Initializable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Scheduler,
    PulseSchedulerGovernance
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    function initialize(
        address owner,
        address admin,
        address pythAddress
    ) external initializer {
        require(owner != address(0), "owner is zero address");
        require(admin != address(0), "admin is zero address");

        __Ownable_init();
        __UUPSUpgradeable_init();

        Scheduler._initialize(admin, pythAddress);
        
        _transferOwnership(owner);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    // Authorize actions that both admin and owner can perform
    function _authorizeAdminAction() internal view override {
        if (msg.sender != owner() && msg.sender != _state.admin)
            revert("Unauthorized");
    }

    function upgradeTo(address newImplementation) external override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);

        magicCheck();

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

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
        if (this.schedulerUpgradableMagic() != 0x50554C5345)
            revert("Invalid upgrade magic");
    }

    function schedulerUpgradableMagic() public pure virtual returns (uint64) {
        return 0x50554C5345; // "PULSE" in hex
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
