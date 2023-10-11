// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./PythRandomState.sol";

interface PythRandomEvents {
    event Requested(PythRandomStructs.Request request);

    event Revealed(PythRandomStructs.Request request, bytes32 userRevelation, bytes32 providerRevelation, bytes32 blockHash, bytes32 randomNumber);
}
