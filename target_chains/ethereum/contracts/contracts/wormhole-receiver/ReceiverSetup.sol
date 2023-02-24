// contracts/Implementation.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./ReceiverGovernance.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

contract ReceiverSetup is ReceiverSetters, ERC1967Upgrade {
    function setup(
        address implementation,
        address[] memory initialGuardians,
        uint16 chainId,
        uint16 governanceChainId,
        bytes32 governanceContract
    ) public {
        require(initialGuardians.length > 0, "no guardians specified");

        ReceiverStructs.GuardianSet memory initialGuardianSet = ReceiverStructs
            .GuardianSet({keys: initialGuardians, expirationTime: 0});

        storeGuardianSet(initialGuardianSet, 0);
        // initial guardian set index is 0, which is the default value of the storage slot anyways

        setChainId(chainId);

        setGovernanceChainId(governanceChainId);
        setGovernanceContract(governanceContract);

        _upgradeTo(implementation);
    }
}
