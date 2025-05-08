// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./SchedulerStructs.sol";
import "./IScheduler.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";

abstract contract AbstractPulse is IScheduler {
    /**
     * @notice Get a price that is no older than the specified age
     * @param subscriptionId The ID of the subscription
     * @param priceId The price ID to get the price for
     * @param maxAge The maximum acceptable age of the price in seconds
     * @return price The price
     */
    function getPriceNoOlderThan(
        uint256 subscriptionId,
        bytes32 priceId,
        uint256 maxAge
    ) public view virtual returns (PythStructs.Price memory price) {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceId;
        
        PythStructs.Price[] memory prices = getPricesNoOlderThan(subscriptionId, priceIds, maxAge);
        return prices[0];
    }

    /**
     * @notice Get prices that are no older than the specified age
     * @param subscriptionId The ID of the subscription
     * @param priceIds Array of price IDs to get prices for
     * @param maxAge The maximum acceptable age of the prices in seconds
     * @return prices Array of prices
     */
    function getPricesNoOlderThan(
        uint256 subscriptionId,
        bytes32[] memory priceIds,
        uint256 maxAge
    ) public view virtual returns (PythStructs.Price[] memory prices) {
        prices = getPricesUnsafe(subscriptionId, priceIds);
        
        for (uint i = 0; i < prices.length; i++) {
            if (block.timestamp - prices[i].publishTime > maxAge) {
                revert PythErrors.StalePrice();
            }
        }
        
        return prices;
    }

    /**
     * @notice Get an EMA price that is no older than the specified age
     * @param subscriptionId The ID of the subscription
     * @param priceId The price ID to get the EMA price for
     * @param maxAge The maximum acceptable age of the price in seconds
     * @return price The EMA price
     */
    function getEmaPriceNoOlderThan(
        uint256 subscriptionId,
        bytes32 priceId,
        uint256 maxAge
    ) public view virtual returns (PythStructs.Price memory price) {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceId;
        
        PythStructs.Price[] memory prices = getEmaPricesNoOlderThan(subscriptionId, priceIds, maxAge);
        return prices[0];
    }

    /**
     * @notice Get EMA prices that are no older than the specified age
     * @param subscriptionId The ID of the subscription
     * @param priceIds Array of price IDs to get EMA prices for
     * @param maxAge The maximum acceptable age of the prices in seconds
     * @return prices Array of EMA prices
     */
    function getEmaPricesNoOlderThan(
        uint256 subscriptionId,
        bytes32[] memory priceIds,
        uint256 maxAge
    ) public view virtual returns (PythStructs.Price[] memory prices) {
        prices = getEmaPriceUnsafe(subscriptionId, priceIds);
        
        for (uint i = 0; i < prices.length; i++) {
            if (block.timestamp - prices[i].publishTime > maxAge) {
                revert PythErrors.StalePrice();
            }
        }
        
        return prices;
    }
}
