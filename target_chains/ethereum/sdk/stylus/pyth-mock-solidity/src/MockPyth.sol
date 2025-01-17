// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.13;

import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
import {console} from "forge-std/console.sol";

contract MockPythSample is MockPyth {
    constructor(
        uint validTimePeriod,
        uint singleUpdateFeeInWei
    ) MockPyth(validTimePeriod, singleUpdateFeeInWei) {}
}
