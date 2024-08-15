// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/PRNG.sol";
import "forge-std/Test.sol";

contract PRNGTestHelper is PRNG {
    constructor(bytes32 _seed) PRNG(_seed) {}

    function publicNextBytes32() public returns (bytes32) {
        return nextBytes32();
    }

    function publicRandUint() public returns (uint256) {
        return randUint();
    }

    function publicRandUint64() public returns (uint64) {
        return randUint64();
    }

    function publicRandUintRange(
        uint256 min,
        uint256 max
    ) public returns (uint256) {
        return randUintRange(min, max);
    }

    function publicRandomPermutation(
        uint256 length
    ) public returns (uint256[] memory) {
        return randomPermutation(length);
    }
}

contract PRNGTest is Test {
    PRNGTestHelper prng;

    function setUp() public {
        prng = new PRNGTestHelper(keccak256(abi.encode("initial seed")));
    }

    function testNextBytes32() public {
        bytes32 randomValue1 = prng.publicNextBytes32();
        bytes32 randomValue2 = prng.publicNextBytes32();

        assertNotEq(
            randomValue1,
            randomValue2,
            "Random values should not be equal"
        );
    }

    function testRandUint() public {
        uint256 randomValue1 = prng.publicRandUint();
        uint256 randomValue2 = prng.publicRandUint();

        assertNotEq(
            randomValue1,
            randomValue2,
            "Random values should not be equal"
        );
    }

    function testRandUint64() public {
        uint64 randomValue1 = prng.publicRandUint64();
        uint64 randomValue2 = prng.publicRandUint64();

        assertNotEq(
            randomValue1,
            randomValue2,
            "Random values should not be equal"
        );
    }

    function testRandUintRange() public {
        uint256 min = 10;
        uint256 max = 20;

        for (uint256 i = 0; i < 100; i++) {
            uint256 randomValue = prng.publicRandUintRange(min, max);
            assertGe(
                randomValue,
                min,
                "Random value should be greater than or equal to min"
            );
            assertLt(randomValue, max, "Random value should be less than max");
        }
    }

    function testRandomPermutation() public {
        uint256 length = 5;
        uint256[] memory permutation = prng.publicRandomPermutation(length);

        assertEq(permutation.length, length, "Permutation length should match");

        bool[] memory found = new bool[](length);
        for (uint256 i = 0; i < length; i++) {
            assertLt(
                permutation[i],
                length,
                "Permutation value should be within range"
            );
            found[permutation[i]] = true;
        }
        for (uint256 i = 0; i < length; i++) {
            assertTrue(found[i], "Permutation should contain all values");
        }
    }
}
