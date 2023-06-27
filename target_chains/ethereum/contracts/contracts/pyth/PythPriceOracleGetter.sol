// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

import "../aave/interfaces/IPriceOracleGetter.sol";
import "./PythAssetRegistry.sol";

contract PythPriceOracleGetter is PythAssetRegistry, IPriceOracleGetter {
    address public immutable override BASE_CURRENCY;
    uint256 public immutable override BASE_CURRENCY_UNIT;

    constructor(
        address pyth,
        address[] memory assets,
        bytes32[] memory priceIds,
        address baseCurrency,
        uint256 baseCurrencyUnit
    ) {
        setPyth(pyth);
        setAssetsSources(assets, priceIds);
        setBaseCurrency(baseCurrency, baseCurrencyUnit);
        BASE_CURRENCY = _registryState.BASE_CURRENCY;
        BASE_CURRENCY_UNIT = _registryState.BASE_CURRENCY_UNIT;
    }

    /// @inheritdoc IPriceOracleGetter
    function getAssetPrice(
        address asset
    ) external view override returns (uint256) {
        bytes32 priceId = _registryState.assetsPriceIds[asset];
        if (asset == BASE_CURRENCY) {
            return BASE_CURRENCY_UNIT;
        }
        if (priceId == 0) {
            revert PythErrors.PriceFeedNotFound();
        }
        return uint256(uint64(pyth().getPriceUnsafe(priceId).price));
    }
}
