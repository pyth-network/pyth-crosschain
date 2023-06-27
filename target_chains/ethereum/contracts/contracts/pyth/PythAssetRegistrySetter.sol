// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythAssetRegistry.sol";

error InconsistentParamsLength();

contract PythAssetRegistrySetter is PythAssetRegistry {
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

    function setPyth(address pyth) internal {
        _registryState.pyth = payable(pyth);
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
}
