// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract MockPythSample is MockPyth {
    uint randNonce = 0;
    string[] tickers  =  ["ETH", "BTC", "USDT", "BNB", "SOL", "MATIC", "ADA", "DOT", "DOGE", "SHIB"];
    bytes32[] priceIds = new bytes32[](tickers.length);

    constructor(
        uint validTimePeriod, uint singleUpdateFeeInWei
    )  MockPyth(validTimePeriod, singleUpdateFeeInWei) {
        getPriceIds();
        for (uint i = 0; i< tickers.length; i++) {
            uint randomNumber = randNumber(priceIds[i],10);
            int64 price = int64(uint64(randomNumber + randNumber(priceIds[i],2)));
            uint64 conf = uint64(randomNumber+ randNumber(priceIds[i],3)); 
            int32 expo = int32(uint32(randomNumber + randNumber(priceIds[i], 40)));
            int64 emaPrice = int64(uint64(randomNumber + randNumber(priceIds[i], 5)));
            uint64 emaConf = uint64(randomNumber + randNumber(priceIds[i], 6));
            createPriceFeedUpdateData(priceIds[i],price, conf, expo,emaPrice, emaConf, uint64(block.timestamp),0);
        }
    }

    function getPriceIds() internal {
        for (uint i = 0; i < tickers.length; i++) {
            bytes memory tempEmptyStringTest = bytes(tickers[i]);
            if (tempEmptyStringTest.length == 0) {
                priceIds[i] = bytes32(0);
            }
            else {
                priceIds[i] = keccak256(abi.encodePacked(tickers[i]));
            }
        }
    }

    function randNumber(bytes32 ticker, uint salt) internal returns(uint)
    {
        // increase nonce
        randNonce++;
        return uint(keccak256(abi.encodePacked(block.timestamp, ticker,msg.sender,randNonce, salt))) % randNonce;
    } 
}