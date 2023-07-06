// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";

error InconsistentParamsLength();

contract PythAssetRegistryStorage {
    struct State {
        address pyth;
        address BASE_CURRENCY;
        uint256 BASE_CURRENCY_UNIT;
        // Map of asset priceIds (asset => priceId)
        mapping(address => bytes32) assetsPriceIds;
        /// Maximum acceptable time period before price is considered to be stale.
        /// This includes attestation delay, block time, and potential clock drift
        /// between the source/target chains.
        uint validTimePeriodSeconds;
    }
}

contract PythAssetRegistry {
    PythAssetRegistryStorage.State _registryState;

    /**
     * @dev Emitted after the base currency is set
     * @param baseCurrency The base currency of used for price quotes
     * @param baseCurrencyUnit The unit of the base currency
     */
    event BaseCurrencySet(
        address indexed baseCurrency,
        uint256 baseCurrencyUnit
    );

    /**
     * @dev Emitted after the price source of an asset is updated
     * @param asset The address of the asset
     * @param source The priceId of the asset
     */
    event AssetSourceUpdated(address indexed asset, bytes32 indexed source);

    function pyth() public view returns (IPyth) {
        return IPyth(_registryState.pyth);
    }

    function setPyth(address pythAddress) internal {
        _registryState.pyth = payable(pythAddress);
    }

    function setAssetsSources(
        address[] memory assets,
        bytes32[] memory priceIds
    ) internal {
        if (assets.length != priceIds.length) {
            revert InconsistentParamsLength();
        }
        for (uint256 i = 0; i < assets.length; i++) {
            _registryState.assetsPriceIds[assets[i]] = priceIds[i];
            emit AssetSourceUpdated(assets[i], priceIds[i]);
        }
    }

    function setBaseCurrency(
        address baseCurrency,
        uint256 baseCurrencyUnit
    ) internal {
        _registryState.BASE_CURRENCY = baseCurrency;
        _registryState.BASE_CURRENCY_UNIT = baseCurrencyUnit;
        emit BaseCurrencySet(baseCurrency, baseCurrencyUnit);
    }

    function setValidTimePeriodSeconds(uint validTimePeriodInSeconds) internal {
        _registryState.validTimePeriodSeconds = validTimePeriodInSeconds;
    }

    function validTimePeriodSeconds() public view returns (uint) {
        return _registryState.validTimePeriodSeconds;
    }
}
