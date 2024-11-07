// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "./Pulse.sol";

contract PulseUpgradeable is
    Initializable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    Pulse
{
    event ContractUpgraded(
        address oldImplementation,
        address newImplementation
    );

    function initialize(
        address owner,
        address admin,
        uint128 pythFeeInWei,
        address defaultProvider,
        address pythAddress,
        bool prefillRequestStorage
    ) public initializer {
        require(owner != address(0), "owner is zero address");

        __Ownable_init();
        __UUPSUpgradeable_init();

        Pulse._initialize(
            admin,
            pythFeeInWei,
            defaultProvider,
            pythAddress,
            prefillRequestStorage
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
