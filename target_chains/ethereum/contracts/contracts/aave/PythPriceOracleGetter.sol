// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "./interfaces/IPriceOracleGetter.sol";
import "./PythAssetRegistry.sol";

/// Invalid non-positive price
error InvalidNonPositivePrice();
/// Normalization overflow
error NormalizationOverflow();
/// Invalid Base Currency Unit value. Must be power of 10.
error InvalidBaseCurrencyUnit();

contract PythPriceOracleGetter is PythAssetRegistry, IPriceOracleGetter {
    /// @inheritdoc IPriceOracleGetter
    address public immutable override BASE_CURRENCY;
    /**
     * @notice Returns the base currency unit
     * @dev 1 ether for ETH, 1e8 for USD.
     * @return Returns the base currency unit.
     */
    uint256 public immutable override BASE_CURRENCY_UNIT;
    /// BASE_CURRENCY_UNIT as a power of 10
    uint8 public immutable BASE_NUM_DECIMALS;

    constructor(
        address pyth,
        address[] memory assets,
        bytes32[] memory priceIds,
        address baseCurrency,
        uint256 baseCurrencyUnit,
        uint validTimePeriodSeconds
    ) {
        if (baseCurrencyUnit == 0) {
            revert InvalidBaseCurrencyUnit();
        }
        PythAssetRegistry.setPyth(pyth);
        PythAssetRegistry.setAssetsSources(assets, priceIds);
        PythAssetRegistry.setBaseCurrency(baseCurrency, baseCurrencyUnit);
        BASE_CURRENCY = _registryState.BASE_CURRENCY;
        BASE_CURRENCY_UNIT = _registryState.BASE_CURRENCY_UNIT;
        if ((10 ** baseNumDecimals(baseCurrencyUnit)) != baseCurrencyUnit) {
            revert InvalidBaseCurrencyUnit();
        }
        BASE_NUM_DECIMALS = baseNumDecimals(baseCurrencyUnit);
        PythAssetRegistry.setValidTimePeriodSeconds(validTimePeriodSeconds);
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
        PythStructs.Price memory price = pyth().getPriceNoOlderThan(
            priceId,
            PythAssetRegistry.validTimePeriodSeconds()
        );

        // Aave is not using any price feeds < 0 for now.
        if (price.price <= 0) {
            revert InvalidNonPositivePrice();
        }
        uint256 normalizedPrice = uint64(price.price);
        int32 normalizerExpo = price.expo + int8(BASE_NUM_DECIMALS);
        bool isNormalizerExpoNeg = normalizerExpo < 0;
        uint256 normalizer = isNormalizerExpoNeg
            ? 10 ** uint32(-normalizerExpo)
            : 10 ** uint32(normalizerExpo);

        // this check prevents overflow in normalized price
        if (!isNormalizerExpoNeg && normalizer > type(uint192).max) {
            revert NormalizationOverflow();
        }

        normalizedPrice = isNormalizerExpoNeg
            ? normalizedPrice / normalizer
            : normalizedPrice * normalizer;

        if (normalizedPrice <= 0) {
            revert InvalidNonPositivePrice();
        }

        return normalizedPrice;
    }

    function baseNumDecimals(uint number) private pure returns (uint8) {
        uint8 digits = 0;
        while (number != 0) {
            number /= 10;
            digits++;
        }
        return digits - 1;
    }
}
