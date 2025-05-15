// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";

/**
 * @title EntropyTester
 * @notice A test contract for invoking entropy requests with configurable callback conditions
 * @dev Supports both V1 and V2 entropy requests with configurable callback behavior
 */
contract EntropyTester is IEntropyConsumer {
    address public defaultEntropy;

    // use callbackKey method to create the key of this mapping
    mapping(bytes32 => CallbackData) public callbackData;

    constructor(address _entropy) {
        defaultEntropy = _entropy;
    }

    /**
     * @notice Makes a V1 entropy request using default entropy and provider addresses
     * @param callbackReverts Whether the callback should revert
     * @param callbackGasUsage Amount of gas the callback should consume
     * @return sequenceNumber The sequence number of the request
     */
    function requestV1(
        bool callbackReverts,
        uint32 callbackGasUsage
    ) public payable returns (uint64 sequenceNumber) {
        sequenceNumber = requestV1(
            address(0),
            address(0),
            callbackReverts,
            callbackGasUsage
        );
    }

    /**
     * @notice Makes a V1 entropy request with specified entropy and provider addresses
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @param _provider Address of the provider (uses default if address(0))
     * @param callbackReverts Whether the callback should revert
     * @param callbackGasUsage Amount of gas the callback should consume
     * @return sequenceNumber The sequence number of the request
     */
    function requestV1(
        address _entropy,
        address _provider,
        bool callbackReverts,
        uint32 callbackGasUsage
    ) public payable returns (uint64 sequenceNumber) {
        requireGasUsageAboveLimit(callbackGasUsage);

        IEntropy entropy = getEntropyWithDefault(_entropy);
        address provider = getProviderWithDefault(entropy, _provider);

        uint128 fee = entropy.getFee(provider);
        sequenceNumber = entropy.requestWithCallback{value: fee}(
            provider,
            // Hardcoding the user contribution because we don't really care for testing the callback.
            // Real users should pass this value in as an argument from the calling function.
            bytes32(uint256(12345))
        );

        callbackData[
            callbackKey(address(entropy), provider, sequenceNumber)
        ] = CallbackData(callbackReverts, callbackGasUsage);
    }

    /**
     * @notice Makes multiple V1 entropy requests in a batch
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @param _provider Address of the provider (uses default if address(0))
     * @param callbackReverts Whether the callbacks should revert
     * @param callbackGasUsage Amount of gas each callback should consume
     * @param count Number of requests to make
     */
    function batchRequestV1(
        address _entropy,
        address _provider,
        bool callbackReverts,
        uint32 callbackGasUsage,
        uint32 count
    ) public payable {
        for (uint64 i = 0; i < count; i++) {
            requestV1(_entropy, _provider, callbackReverts, callbackGasUsage);
        }
    }

    /**
     * @notice Makes a V2 entropy request using default entropy and provider addresses
     * @param gasLimit Gas limit for the callback
     * @param callbackReverts Whether the callback should revert
     * @param callbackGasUsage Amount of gas the callback should consume
     * @return sequenceNumber The sequence number of the request
     */
    function requestV2(
        uint32 gasLimit,
        bool callbackReverts,
        uint32 callbackGasUsage
    ) public payable returns (uint64 sequenceNumber) {
        sequenceNumber = requestV2(
            address(0),
            address(0),
            gasLimit,
            callbackReverts,
            callbackGasUsage
        );
    }

    /**
     * @notice Makes a V2 entropy request with specified entropy and provider addresses
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @param _provider Address of the provider (uses default if address(0))
     * @param gasLimit Gas limit for the callback
     * @param callbackReverts Whether the callback should revert
     * @param callbackGasUsage Amount of gas the callback should consume
     * @return sequenceNumber The sequence number of the request
     */
    function requestV2(
        address _entropy,
        address _provider,
        uint32 gasLimit,
        bool callbackReverts,
        uint32 callbackGasUsage
    ) public payable returns (uint64 sequenceNumber) {
        requireGasUsageAboveLimit(callbackGasUsage);

        IEntropy entropy = getEntropyWithDefault(_entropy);
        address provider = getProviderWithDefault(entropy, _provider);

        uint128 fee = entropy.getFeeV2(provider, gasLimit);
        sequenceNumber = entropy.requestV2{value: fee}(provider, gasLimit);

        callbackData[
            callbackKey(address(entropy), provider, sequenceNumber)
        ] = CallbackData(callbackReverts, callbackGasUsage);
    }

    /**
     * @notice Makes multiple V2 entropy requests in a batch
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @param _provider Address of the provider (uses default if address(0))
     * @param gasLimit Gas limit for the callbacks
     * @param callbackReverts Whether the callbacks should revert
     * @param callbackGasUsage Amount of gas each callback should consume
     * @param count Number of requests to make
     */
    function batchRequestV2(
        address _entropy,
        address _provider,
        uint32 gasLimit,
        bool callbackReverts,
        uint32 callbackGasUsage,
        uint32 count
    ) public payable {
        for (uint64 i = 0; i < count; i++) {
            requestV2(
                _entropy,
                _provider,
                gasLimit,
                callbackReverts,
                callbackGasUsage
            );
        }
    }

    /**
     * @notice Modifies the callback behavior for an existing request
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @param _provider Address of the provider (uses default if address(0))
     * @param sequenceNumber Sequence number of the request to modify
     * @param callbackReverts Whether the callback should revert
     * @param callbackGasUsage Amount of gas the callback should consume
     */
    function modifyCallback(
        address _entropy,
        address _provider,
        uint64 sequenceNumber,
        bool callbackReverts,
        uint32 callbackGasUsage
    ) public {
        requireGasUsageAboveLimit(callbackGasUsage);

        IEntropy entropy = getEntropyWithDefault(_entropy);
        address provider = getProviderWithDefault(entropy, _provider);

        callbackData[
            callbackKey(address(entropy), provider, sequenceNumber)
        ] = CallbackData(callbackReverts, callbackGasUsage);
    }

    /**
     * @notice Callback function that gets called by the entropy contract
     * @dev Implements IEntropyConsumer interface
     * @param _sequence Sequence number of the request
     * @param _provider Address of the provider
     * @param _randomness The random value provided by the entropy contract
     */
    function entropyCallback(
        uint64 _sequence,
        address _provider,
        bytes32 _randomness
    ) internal override {
        uint256 startGas = gasleft();

        bytes32 key = callbackKey(msg.sender, _provider, _sequence);
        CallbackData memory callback = callbackData[key];
        delete callbackData[key];

        // Keep consuming gas until we reach our target
        uint256 currentGasUsed = startGas - gasleft();
        while (currentGasUsed < callback.gasUsage) {
            // Consume gas with a hash operation
            keccak256(abi.encodePacked(currentGasUsed, _randomness));
            currentGasUsed = startGas - gasleft();
        }

        if (callback.reverts) {
            revert("Callback failed");
        }
    }

    function getEntropy() internal view override returns (address) {
        return defaultEntropy;
    }

    /**
     * @notice Gets the entropy contract address, using default if none specified
     * @param _entropy Address of the entropy contract (uses default if address(0))
     * @return entropy The entropy contract interface
     */
    function getEntropyWithDefault(
        address _entropy
    ) internal view returns (IEntropy entropy) {
        if (_entropy != address(0)) {
            entropy = IEntropy(_entropy);
        } else {
            entropy = IEntropy(defaultEntropy);
        }
    }

    /**
     * @notice Gets the provider address, using default if none specified
     * @param entropy The entropy contract interface
     * @param _provider Address of the provider (uses default if address(0))
     * @return provider The provider address
     */
    function getProviderWithDefault(
        IEntropy entropy,
        address _provider
    ) internal view returns (address provider) {
        if (_provider == address(0)) {
            provider = entropy.getDefaultProvider();
        } else {
            provider = _provider;
        }
    }

    /**
     * @notice Ensures the gas usage is above the minimum required limit
     * @param gasUsage The gas usage to check
     */
    function requireGasUsageAboveLimit(uint32 gasUsage) internal pure {
        require(
            gasUsage > 60000,
            "Target gas usage cannot be below 60k (~upper bound on necessary callback operations)"
        );
    }

    /**
     * @notice Generates a unique key for callback data storage
     * @param entropy Address of the entropy contract
     * @param provider Address of the provider
     * @param sequenceNumber Sequence number of the request
     * @return key The unique key for the callback data
     */
    function callbackKey(
        address entropy,
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 key) {
        key = keccak256(abi.encodePacked(entropy, provider, sequenceNumber));
    }

    struct CallbackData {
        bool reverts;
        uint32 gasUsage;
    }
}
