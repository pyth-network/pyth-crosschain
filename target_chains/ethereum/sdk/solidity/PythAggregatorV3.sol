// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import {PythStructs} from "./PythStructs.sol";
import {IPyth} from "./IPyth.sol";

// This interface is forked from the Zerolend Adapter found here:
// https://github.com/zerolend/pyth-oracles/blob/master/contracts/PythAggregatorV3.sol
// Original license found under licenses/zerolend-pyth-oracles.md

/**
 * @title A port of the ChainlinkAggregatorV3 interface that supports Pyth price feeds
 * @notice This does not store any roundId information on-chain. Please review the code before using this implementation.
 * Users should deploy an instance of this contract to wrap every price feed id that they need to use.
 */
contract PythAggregatorV3 {
    bytes32 public priceId;
    IPyth public pyth;

    constructor(address _pyth, bytes32 _priceId) {
        priceId = _priceId;
        pyth = IPyth(_pyth);
    }

    // Wrapper function to update the underlying Pyth price feeds. Not part of the AggregatorV3 interface but useful.
    function updateFeeds(bytes[] calldata priceUpdateData) public payable {
        // Update the prices to the latest available values and pay the required fee for it. The `priceUpdateData` data
        // should be retrieved from our off-chain Price Service API using the `pyth-evm-js` package.
        // See section "How Pyth Works on EVM Chains" below for more information.
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // refund remaining eth
        payable(msg.sender).call{value: address(this).balance}("");
    }

    function decimals() public view virtual returns (uint8) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        return uint8(-1 * int8(price.expo));
    }

    function description() public pure returns (string memory) {
        return "A port of a chainlink aggregator powered by pyth network feeds";
    }

    function version() public pure returns (uint256) {
        return 1;
    }

    function latestAnswer() public view virtual returns (int256) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        return int256(price.price);
    }

    function latestTimestamp() public view returns (uint256) {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        return price.publishTime;
    }

    function latestRound() public view returns (uint256) {
        // use timestamp as the round id
        return latestTimestamp();
    }

    function getAnswer(uint256) public view returns (int256) {
        return latestAnswer();
    }

    function getTimestamp(uint256) external view returns (uint256) {
        return latestTimestamp();
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        return (
            _roundId,
            int256(price.price),
            price.publishTime,
            price.publishTime,
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        roundId = uint80(price.publishTime);
        return (
            roundId,
            int256(price.price),
            price.publishTime,
            price.publishTime,
            roundId
        );
    }
}
