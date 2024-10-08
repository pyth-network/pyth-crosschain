// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythStructs.sol";
import "./PriceCombine.sol";

// This contract is used to test the library functions and tested in Remix IDE. All ABIs are present in the /abis folder
contract PriceCombineTest {
    using PriceCombine for PythStructs.Price;

    /**
     * @notice Test the getPriceInQuote function
     * @param basePrice The price of the base currency (example: SOL/USD) 13913000000 (represents the current SOL/USD $139.13 with 8 decimal places)
     * @param baseConf The confidence interval of the base currency
     * @param baseExpo The exponent of the base currency (here: -8 -> 8 decimal units) indicates price is scaled by 10^-8
     * @param basePublishTime The publish time of the base currency (UNIX timestamp)
     * @param quotePrice The price of the quote currency (example: ETH/USD) 341853000000 (represents the current ETH/USD $3418.53 with 8 decimal places)
     * @param quoteConf The confidence interval of the quote currency
     * @param quoteExpo The exponent of the quote currency (here: -8 -> 8 decimal units) indicates price is scaled by 10^-8
     * @param quotePublishTime The publish time of the quote currency (UNIX timestamp)
     * @param resultExpo The desired exponent for the result (here: -8)
     * @return The price, confidence interval, exponent, and publish time of the resulting price
     */
    function testGetPriceInQuote(int64 basePrice, uint64 baseConf, int32 baseExpo, uint basePublishTime, 
                                 int64 quotePrice, uint64 quoteConf, int32 quoteExpo, uint quotePublishTime,
                                 int32 resultExpo) public pure returns (int64, uint64, int32, uint) {
        PythStructs.Price memory base = PythStructs.Price(basePrice, baseConf, baseExpo, basePublishTime);
        PythStructs.Price memory quote = PythStructs.Price(quotePrice, quoteConf, quoteExpo, quotePublishTime);
        PythStructs.Price memory result = base.getPriceInQuote(quote, resultExpo);
        return (result.price, result.conf, result.expo, result.publishTime);
    }

    // Add more test functions as needed
}
