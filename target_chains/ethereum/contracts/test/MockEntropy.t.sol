// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@pythnetwork/entropy-sdk-solidity/MockEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

contract MockEntropyConsumer is IEntropyConsumer {
    address public entropy;
    bytes32 public lastRandomNumber;
    uint64 public lastSequenceNumber;
    address public lastProvider;
    uint256 public callbackCount;

    constructor(address _entropy) {
        entropy = _entropy;
    }

    function requestRandomNumber() external payable returns (uint64) {
        return MockEntropy(entropy).requestV2{value: msg.value}();
    }

    function requestRandomNumberWithGasLimit(
        uint32 gasLimit
    ) external payable returns (uint64) {
        return MockEntropy(entropy).requestV2{value: msg.value}(gasLimit);
    }

    function requestRandomNumberFromProvider(
        address provider,
        uint32 gasLimit
    ) external payable returns (uint64) {
        return
            MockEntropy(entropy).requestV2{value: msg.value}(
                provider,
                gasLimit
            );
    }

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal override {
        lastSequenceNumber = sequenceNumber;
        lastProvider = provider;
        lastRandomNumber = randomNumber;
        callbackCount += 1;
    }
}

contract MockEntropyTest is Test {
    MockEntropy public entropy;
    MockEntropyConsumer public consumer;
    address public provider;

    function setUp() public {
        provider = address(0x1234);
        entropy = new MockEntropy(provider);
        consumer = new MockEntropyConsumer(address(entropy));
    }

    function testBasicRequestAndReveal() public {
        uint64 seq = consumer.requestRandomNumber();
        assertEq(seq, 1, "Sequence number should be 1");

        bytes32 randomNumber = bytes32(uint256(42));
        entropy.mockReveal(provider, seq, randomNumber);

        assertEq(
            consumer.lastSequenceNumber(),
            seq,
            "Callback sequence number mismatch"
        );
        assertEq(
            consumer.lastProvider(),
            provider,
            "Callback provider mismatch"
        );
        assertEq(
            consumer.lastRandomNumber(),
            randomNumber,
            "Random number mismatch"
        );
        assertEq(consumer.callbackCount(), 1, "Callback should be called once");
    }

    function testDifferentInterleavings() public {
        uint64 seq1 = consumer.requestRandomNumber();
        uint64 seq2 = consumer.requestRandomNumber();
        uint64 seq3 = consumer.requestRandomNumber();

        assertEq(seq1, 1, "First sequence should be 1");
        assertEq(seq2, 2, "Second sequence should be 2");
        assertEq(seq3, 3, "Third sequence should be 3");

        bytes32 random2 = bytes32(uint256(200));
        bytes32 random3 = bytes32(uint256(300));
        bytes32 random1 = bytes32(uint256(100));

        entropy.mockReveal(provider, seq2, random2);
        assertEq(
            consumer.lastRandomNumber(),
            random2,
            "Should reveal seq2 first"
        );
        assertEq(consumer.lastSequenceNumber(), seq2, "Sequence should be 2");

        entropy.mockReveal(provider, seq3, random3);
        assertEq(
            consumer.lastRandomNumber(),
            random3,
            "Should reveal seq3 second"
        );
        assertEq(consumer.lastSequenceNumber(), seq3, "Sequence should be 3");

        entropy.mockReveal(provider, seq1, random1);
        assertEq(
            consumer.lastRandomNumber(),
            random1,
            "Should reveal seq1 last"
        );
        assertEq(consumer.lastSequenceNumber(), seq1, "Sequence should be 1");

        assertEq(
            consumer.callbackCount(),
            3,
            "All three callbacks should be called"
        );
    }

    function testDifferentProviders() public {
        address provider2 = address(0x5678);

        uint64 seq1 = consumer.requestRandomNumberFromProvider(
            provider,
            100000
        );
        uint64 seq2 = consumer.requestRandomNumberFromProvider(
            provider2,
            100000
        );

        assertEq(seq1, 1, "Provider 1 first sequence should be 1");
        assertEq(seq2, 1, "Provider 2 first sequence should be 1");

        bytes32 random1 = bytes32(uint256(111));
        bytes32 random2 = bytes32(uint256(222));

        entropy.mockReveal(provider, seq1, random1);
        assertEq(
            consumer.lastRandomNumber(),
            random1,
            "First provider random number"
        );

        entropy.mockReveal(provider2, seq2, random2);
        assertEq(
            consumer.lastRandomNumber(),
            random2,
            "Second provider random number"
        );
    }

    function testRequestWithGasLimit() public {
        uint64 seq = consumer.requestRandomNumberWithGasLimit(200000);

        assertEq(seq, 1, "Sequence should be 1");

        EntropyStructsV2.Request memory req = entropy.getRequestV2(
            provider,
            seq
        );
        assertEq(req.gasLimit10k, 20, "Gas limit should be 20 (200k / 10k)");

        bytes32 randomNumber = bytes32(uint256(999));
        entropy.mockReveal(provider, seq, randomNumber);

        assertEq(
            consumer.lastRandomNumber(),
            randomNumber,
            "Random number should match"
        );
    }

    function testGetProviderInfo() public {
        EntropyStructsV2.ProviderInfo memory info = entropy.getProviderInfoV2(
            provider
        );
        assertEq(info.feeInWei, 1, "Fee should be 1");
        assertEq(
            info.defaultGasLimit,
            100000,
            "Default gas limit should be 100000"
        );
        assertEq(info.sequenceNumber, 1, "Sequence number should start at 1");
    }

    function testGetDefaultProvider() public {
        assertEq(
            entropy.getDefaultProvider(),
            provider,
            "Default provider should match"
        );
    }

    function testFeesReturnZero() public {
        assertEq(entropy.getFeeV2(), 0, "getFeeV2() should return 0");
        assertEq(
            entropy.getFeeV2(100000),
            0,
            "getFeeV2(gasLimit) should return 0"
        );
        assertEq(
            entropy.getFeeV2(provider, 100000),
            0,
            "getFeeV2(provider, gasLimit) should return 0"
        );
    }

    function testCustomRandomNumbers() public {
        uint64 seq = consumer.requestRandomNumber();

        bytes32[] memory randomNumbers = new bytes32[](3);
        randomNumbers[0] = bytes32(uint256(0));
        randomNumbers[1] = bytes32(type(uint256).max);
        randomNumbers[2] = keccak256("custom random value");

        for (uint i = 0; i < randomNumbers.length; i++) {
            if (i > 0) {
                seq = consumer.requestRandomNumber();
            }
            entropy.mockReveal(provider, seq, randomNumbers[i]);
            assertEq(
                consumer.lastRandomNumber(),
                randomNumbers[i],
                "Custom random number should match"
            );
        }
    }
}
