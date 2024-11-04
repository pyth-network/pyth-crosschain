// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "./IPulse.sol";
import "./PulseState.sol";
import "./PulseErrors.sol";

contract Pulse is IPulse, ReentrancyGuard, PulseState {
    using SafeCast for uint256;

    function _initialize(
        address admin,
        uint128 pythFeeInWei,
        address defaultProvider,
        bool prefillRequestStorage
    ) internal {
        require(admin != address(0), "admin is zero address");
        require(
            defaultProvider != address(0),
            "defaultProvider is zero address"
        );

        _state.admin = admin;
        _state.pythFeeInWei = pythFeeInWei;
        _state.accruedPythFeesInWei = 0;
        _state.defaultProvider = defaultProvider;

        if (prefillRequestStorage) {
            // Prefill storage slots to make future requests use less gas
            for (uint8 i = 0; i < NUM_REQUESTS; i++) {
                Request storage req = _state.requests[i];
                req.provider = address(1);
                req.sequenceNumber = 0; // Keep it inactive
                req.publishTime = 1;
                // No need to prefill dynamic arrays (priceIds, updateData)
                req.callbackGasLimit = 1;
                req.requester = address(1);
            }
        }
    }

    function requestPriceUpdatesWithCallback(
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    )
        external
        payable
        override
        nonReentrant
        returns (uint64 requestSequenceNumber)
    {
        ProviderInfo storage providerInfo = _state.providers[provider];
        if (providerInfo.sequenceNumber == 0) revert NoSuchProvider();

        if (
            providerInfo.maxNumPrices > 0 &&
            priceIds.length > providerInfo.maxNumPrices
        ) {
            revert("Exceeds max number of prices");
        }

        // Assign sequence number and increment
        requestSequenceNumber = providerInfo.sequenceNumber++;

        // Verify fee payment
        uint128 requiredFee = getFee(provider);
        if (msg.value < requiredFee) revert InsufficientFee();

        // Store request for callback execution
        Request storage req = allocRequest(provider, requestSequenceNumber);
        req.provider = provider;
        req.sequenceNumber = requestSequenceNumber;
        req.publishTime = publishTime;
        req.priceIds = priceIds;
        req.updateData = updateData;
        req.callbackGasLimit = callbackGasLimit;
        req.requester = msg.sender;

        // Update fee balances
        providerInfo.accruedFeesInWei += providerInfo.feeInWei;
        _state.accruedPythFeesInWei += (msg.value.toUint128() -
            providerInfo.feeInWei);

        emit PriceUpdateRequested(
            requestSequenceNumber,
            provider,
            publishTime,
            priceIds,
            msg.sender
        );
    }

    function executeCallback(
        uint64 sequenceNumber,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    ) external override nonReentrant {
        Request storage req = findActiveRequest(msg.sender, sequenceNumber);

        // Verify request parameters match
        require(req.publishTime == publishTime, "Invalid publish time");
        require(
            keccak256(abi.encode(req.priceIds)) ==
                keccak256(abi.encode(priceIds)),
            "Invalid price IDs"
        );
        require(
            keccak256(abi.encode(req.updateData)) ==
                keccak256(abi.encode(updateData)),
            "Invalid update data"
        );
        require(
            req.callbackGasLimit == callbackGasLimit,
            "Invalid callback gas limit"
        );

        // Execute callback but don't revert if it fails
        try
            IPulseConsumer(req.requester).pulseCallback(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds
            )
        {
            // Callback succeeded
            emit PriceUpdateExecuted(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds
            );
        } catch Error(string memory reason) {
            // Explicit revert/require
            emit PriceUpdateCallbackFailed(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds,
                req.requester,
                reason
            );
        } catch {
            // Out of gas or other low-level errors
            emit PriceUpdateCallbackFailed(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds,
                req.requester,
                "low-level error (possibly out of gas)"
            );
        }

        // Clear request regardless of callback success
        clearRequest(msg.sender, sequenceNumber);
    }

    function register(uint128 feeInWei, bytes calldata uri) public override {
        ProviderInfo storage provider = _state.providers[msg.sender];

        provider.feeInWei = feeInWei;
        provider.uri = uri;

        if (provider.sequenceNumber == 0) {
            provider.sequenceNumber = 1;
        }

        emit ProviderRegistered(msg.sender, feeInWei, uri);
    }

    function setProviderFee(uint128 newFeeInWei) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) revert NoSuchProvider();

        uint128 oldFeeInWei = provider.feeInWei;
        provider.feeInWei = newFeeInWei;

        emit ProviderFeeUpdated(msg.sender, oldFeeInWei, newFeeInWei);
    }

    function getFee(
        address provider
    ) public view override returns (uint128 feeAmount) {
        feeAmount = _state.providers[provider].feeInWei + _state.pythFeeInWei;
    }

    function getDefaultProvider()
        external
        view
        override
        returns (address defaultProvider)
    {
        defaultProvider = _state.defaultProvider;
    }

    // Internal helper functions
    function findActiveRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (Request storage activeRequest) {
        activeRequest = findRequest(provider, sequenceNumber);
        if (
            !isActive(activeRequest) ||
            activeRequest.provider != provider ||
            activeRequest.sequenceNumber != sequenceNumber
        ) {
            revert NoSuchRequest();
        }
    }

    function findRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (Request storage foundRequest) {
        (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);
        foundRequest = _state.requests[shortKey];

        if (
            foundRequest.provider == provider &&
            foundRequest.sequenceNumber == sequenceNumber
        ) {
            return foundRequest;
        } else {
            foundRequest = _state.requestsOverflow[key];
        }
    }

    function clearRequest(address provider, uint64 sequenceNumber) internal {
        (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);
        Request storage req = _state.requests[shortKey];

        if (req.provider == provider && req.sequenceNumber == sequenceNumber) {
            req.sequenceNumber = 0;
        } else {
            delete _state.requestsOverflow[key];
        }
    }

    function allocRequest(
        address provider,
        uint64 sequenceNumber
    ) internal returns (Request storage newRequest) {
        (, uint8 shortKey) = requestKey(provider, sequenceNumber);
        newRequest = _state.requests[shortKey];

        if (isActive(newRequest)) {
            (bytes32 reqKey, ) = requestKey(
                newRequest.provider,
                newRequest.sequenceNumber
            );
            _state.requestsOverflow[reqKey] = newRequest;
        }
    }

    function requestKey(
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hashKey, uint8 shortHashKey) {
        hashKey = keccak256(abi.encodePacked(provider, sequenceNumber));
        shortHashKey = uint8(hashKey[0] & NUM_REQUESTS_MASK);
    }

    function isActive(
        Request storage req
    ) internal view returns (bool isRequestActive) {
        isRequestActive = req.sequenceNumber != 0;
    }

    function withdraw(uint128 amount) public override {
        ProviderInfo storage providerInfo = _state.providers[msg.sender];

        // Use checks-effects-interactions pattern to prevent reentrancy attacks
        require(
            providerInfo.accruedFeesInWei >= amount,
            "Insufficient balance"
        );
        providerInfo.accruedFeesInWei -= amount;

        // Interaction with an external contract or token transfer
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "withdrawal to msg.sender failed");

        emit ProviderWithdrawn(msg.sender, msg.sender, amount);
    }

    function withdrawAsFeeManager(
        address provider,
        uint128 amount
    ) external override {
        ProviderInfo storage providerInfo = _state.providers[provider];

        if (providerInfo.sequenceNumber == 0) {
            revert NoSuchProvider();
        }

        if (providerInfo.feeManager != msg.sender) {
            revert Unauthorized();
        }

        // Use checks-effects-interactions pattern to prevent reentrancy attacks
        require(
            providerInfo.accruedFeesInWei >= amount,
            "Insufficient balance"
        );
        providerInfo.accruedFeesInWei -= amount;

        // Interaction with an external contract or token transfer
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "withdrawal to msg.sender failed");

        emit ProviderWithdrawn(provider, msg.sender, amount);
    }

    function setFeeManager(address manager) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) revert NoSuchProvider();

        address oldFeeManager = provider.feeManager;
        provider.feeManager = manager;

        emit ProviderFeeManagerUpdated(msg.sender, oldFeeManager, manager);
    }

    function setProviderFeeAsFeeManager(
        address provider,
        uint128 newFeeInWei
    ) external override {
        ProviderInfo storage providerInfo = _state.providers[provider];

        if (providerInfo.sequenceNumber == 0) {
            revert NoSuchProvider();
        }

        if (providerInfo.feeManager != msg.sender) {
            revert Unauthorized();
        }

        uint128 oldFeeInWei = providerInfo.feeInWei;
        providerInfo.feeInWei = newFeeInWei;

        emit ProviderFeeUpdated(provider, oldFeeInWei, newFeeInWei);
    }

    function getAccruedPythFees()
        public
        view
        override
        returns (uint128 accruedPythFeesInWei)
    {
        accruedPythFeesInWei = _state.accruedPythFeesInWei;
    }

    function getProviderInfo(
        address provider
    ) public view override returns (ProviderInfo memory info) {
        info = _state.providers[provider];
    }

    function getAdmin() external view override returns (address adminAddress) {
        adminAddress = _state.admin;
    }

    function getPythFeeInWei()
        external
        view
        override
        returns (uint128 pythFee)
    {
        pythFee = _state.pythFeeInWei;
    }

    function setProviderUri(bytes calldata uri) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) revert NoSuchProvider();

        bytes memory oldUri = provider.uri;
        provider.uri = uri;

        emit ProviderUriUpdated(msg.sender, oldUri, uri);
    }

    function setMaxNumPrices(uint32 maxNumPrices) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) revert NoSuchProvider();

        uint32 oldMaxNumPrices = provider.maxNumPrices;
        provider.maxNumPrices = maxNumPrices;

        emit ProviderMaxNumPricesUpdated(
            msg.sender,
            oldMaxNumPrices,
            maxNumPrices
        );
    }

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) public view override returns (Request memory req) {
        req = findRequest(provider, sequenceNumber);
    }
}
