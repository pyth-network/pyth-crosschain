// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";

interface EntropyEvents {
    event Registered(EntropyStructs.ProviderInfo provider);

    event Requested(address provider, EntropyStructs.Request request);

    event Revealed(
        EntropyStructs.Request request,
        bytes32 userRevelation,
        bytes32 providerRevelation,
        bytes32 blockHash,
        bytes32 randomNumber
    );
}
