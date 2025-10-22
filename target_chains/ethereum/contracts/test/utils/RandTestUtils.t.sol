// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

contract RandTestUtils is Test {
    uint randSeed;

    function setRandSeed(uint seed) internal {
        randSeed = seed;
    }

    function getRandBytes32() internal returns (bytes32) {
        unchecked {
            randSeed++;
        }
        return keccak256(abi.encode(randSeed));
    }

    function getRandUint() internal returns (uint) {
        return uint(getRandBytes32());
    }

    function getRandUint64() internal returns (uint64) {
        return uint64(getRandUint());
    }

    function getRandInt64() internal returns (int64) {
        return int64(getRandUint64());
    }

    function getRandUint32() internal returns (uint32) {
        return uint32(getRandUint());
    }

    function getRandInt32() internal returns (int32) {
        return int32(getRandUint32());
    }

    function getRandUint8() internal returns (uint8) {
        return uint8(getRandUint());
    }

    function getRandInt8() internal returns (int8) {
        return int8(getRandUint8());
    }
}
