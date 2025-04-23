// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "./Echo.sol";

contract EchoUpgradeable is
    Initializable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Echo
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    function initialize(
        address owner,
        address admin,
        uint96 pythFeeInWei,
        address pythAddress,
        address defaultProvider,
        bool prefillRequestStorage,
        uint32 exclusivityPeriodSeconds
    ) external initializer {
        require(owner != address(0), "owner is zero address");
        require(admin != address(0), "admin is zero address");

        __Ownable_init();
        __UUPSUpgradeable_init();

        Echo._initialize(
            admin,
            pythFeeInWei,
            pythAddress,
            defaultProvider,
            prefillRequestStorage,
            exclusivityPeriodSeconds
        );

        _transferOwnership(owner);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function upgradeTo(address newImplementation) external override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    function upgradeToAndCall(
        address newImplementation,
        bytes memory data
    ) external payable override onlyProxy {
        address oldImplementation = _getImplementation();
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);

        emit ContractUpgraded(oldImplementation, _getImplementation());
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
