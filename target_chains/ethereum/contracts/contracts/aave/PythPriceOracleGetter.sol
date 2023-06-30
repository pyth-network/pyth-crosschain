// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import "./interfaces/IPriceOracleGetter.sol";
import "./PythAssetRegistry.sol";
import "forge-std/console.sol";

contract PythPriceOracleGetter is PythAssetRegistry, IPriceOracleGetter {
    /// @inheritdoc IPriceOracleGetter
    address public immutable override BASE_CURRENCY;
    /// In Aave, for USD, this is 1e8
    uint256 public immutable override BASE_CURRENCY_UNIT;
    uint8 public immutable BASE_EXPONENTS;

    constructor(
        address pyth,
        address[] memory assets,
        bytes32[] memory priceIds,
        address baseCurrency,
        uint256 baseCurrencyUnit,
        uint validTimePeriodSeconds
    ) {
        PythAssetRegistry.setPyth(pyth);
        PythAssetRegistry.setAssetsSources(assets, priceIds);
        PythAssetRegistry.setBaseCurrency(baseCurrency, baseCurrencyUnit);
        BASE_CURRENCY = _registryState.BASE_CURRENCY;
        BASE_CURRENCY_UNIT = _registryState.BASE_CURRENCY_UNIT;
        BASE_EXPONENTS = baseExponents(baseCurrencyUnit);
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

        // price.price is always positive and therefore this cast is safe.
        uint256 normalizedPrice = uint64(price.price);
        // price.expo is bound between [-12, 12]
        int32 normalizerExpo = price.expo + int8(BASE_EXPONENTS);

        if (normalizerExpo < 0) {
            return normalizedPrice / (10 ** uint32(-normalizerExpo));
        } else {
            return normalizedPrice * (10 ** uint32(normalizerExpo));
        }
    }

    function baseExponents(uint number) private pure returns (uint8) {
        uint8 digits = 0;
        while (number != 0) {
            number /= 10;
            digits++;
        }
        return digits - 1;
    }
}
