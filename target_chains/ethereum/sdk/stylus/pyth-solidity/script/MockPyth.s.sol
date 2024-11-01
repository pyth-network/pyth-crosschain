/// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MockPythSample} from "../src/MockPyth.sol";

contract MockPythScript is Script {
    uint randNonce = 0;
    string[] tickers  =  ["ETH", "BTC", "USDT", "BNB", "SOL", "MATIC", "ADA", "DOT", "DOGE", "SHIB"];
    bytes[]  priceData = new bytes[](tickers.length);
    bytes32[] priceIds = new bytes32[](tickers.length);
    MockPythSample pyth_contract;

    function setUp() public {
    
    }

    function run() public {
        vm.startBroadcast();
        deploy(100000, 100);
        _generateInitialData();
        console.log("Pyth contract address:", address(pyth_contract));
        uint update_cost = pyth_contract.getUpdateFee(priceData);
        pyth_contract.updatePriceFeeds{value: update_cost}(priceData);
        vm.stopBroadcast();
    }
    
    function deploy(uint validTimePeriod, uint singleUpdateFeeInWei) internal {
        pyth_contract = new MockPythSample(validTimePeriod, singleUpdateFeeInWei);
    }

    function _generateInitialData() internal {
        for (uint i = 0; i < tickers.length; i++) {
            priceIds[i] = keccak256(abi.encodePacked(tickers[i]));
            uint randomNumber = randNumber(priceIds[i], 10);
            int64 price = int64(uint64(randomNumber + randNumber(priceIds[i], 2)) + 1);
            uint64 conf = uint64(randomNumber + randNumber(priceIds[i], 3) + 1); 
            int32 expo = int32(uint32(randomNumber + randNumber(priceIds[i], 40)) + 1);
            int64 emaPrice = int64(uint64(randomNumber + randNumber(priceIds[i], 5)) + 1);
            uint64 emaConf = uint64(randomNumber + randNumber(priceIds[i], 6) +1);
            priceData[i] = pyth_contract.createPriceFeedUpdateData(priceIds[i], price, conf, expo, emaPrice, emaConf, uint64(block.timestamp), 0);
        }
    }

    function randNumber(bytes32 ticker, uint salt) internal returns (uint) {
        randNonce++;
        return uint(keccak256(abi.encodePacked(block.timestamp, ticker, msg.sender, randNonce, salt))) % randNonce;
    } 
}
