/// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MockPythSample} from "../src/MockPyth.sol";

contract MockPythScript is Script {
    uint randNonce = 0;
    string[] tickers = [
        "ETH",
        "BTC",
        "USDT",
        "BNB",
        "SOL",
        "MATIC",
        "ADA",
        "DOT",
        "DOGE",
        "SHIB"
    ];
    bytes[] priceData = new bytes[](tickers.length);
    bytes32[] priceIds = new bytes32[](tickers.length);
    MockPythSample pyth_contract;

    function setUp() public {}

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
        pyth_contract = new MockPythSample(
            validTimePeriod,
            singleUpdateFeeInWei
        );
    }

    function _generateInitialData() internal {
        for (uint i = 0; i < tickers.length; i++) {
            priceIds[i] = keccak256(abi.encodePacked(tickers[i]));

            uint randomBase = uint(
                keccak256(
                    abi.encodePacked(block.timestamp, priceIds[i], msg.sender)
                )
            );

            int64 price = int64(uint64(_deriveRandom(randomBase, 1) % 10));
            uint64 conf = uint64(_deriveRandom(randomBase, 2) % 10);
            int32 expo = int32(uint32(_deriveRandom(randomBase, 3) % 40));
            int64 emaPrice = int64(uint64(_deriveRandom(randomBase, 4) % 10));
            uint64 emaConf = uint64(_deriveRandom(randomBase, 5) % 10);
            priceData[i] = pyth_contract.createPriceFeedUpdateData(
                priceIds[i],
                price,
                conf,
                expo,
                emaPrice,
                emaConf,
                uint64(block.timestamp),
                0
            );
        }
    }

    // Internal function to generate deterministic random numbers from a base seed
    function _deriveRandom(uint base, uint salt) internal pure returns (uint) {
        return uint(keccak256(abi.encodePacked(base, salt))) + 1;
    }

    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            bstr[--k] = bytes1(uint8(48 + (j % 10)));
            j /= 10;
        }
        str = string(bstr);
    }
}
