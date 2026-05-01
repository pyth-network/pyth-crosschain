// contracts/ImplementationHalf.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./ReceiverImplementation.sol";

/// @dev Variant of `ReceiverImplementation` that requires only a 1/2 + 1
/// majority of guardian signatures to verify a VAA, instead of the default
/// 2/3 + 1.
contract ReceiverImplementationHalf is ReceiverImplementation {
    function quorumThreshold(
        uint numGuardians
    ) internal pure override returns (uint) {
        return numGuardians / 2 + 1;
    }
}
