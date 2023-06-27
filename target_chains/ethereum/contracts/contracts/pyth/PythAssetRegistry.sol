// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

contract PythAssetRegistry {
    PythAssetRegistryStorage.State _registryState;
}

contract PythAssetRegistryStorage {
    struct State {
        address pyth;
        address BASE_CURRENCY;
        uint256 BASE_CURRENCY_UNIT;
        // Map of asset priceIds (asset => priceId)
        mapping(address => bytes32) assetsPriceIds;
    }
}
