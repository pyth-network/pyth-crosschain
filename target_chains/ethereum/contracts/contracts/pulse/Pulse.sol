// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "./IPulse.sol";
import "./PulseState.sol";
import "./PulseErrors.sol";

abstract contract Pulse is IPulse, PulseState {
    function _initialize(
        address admin,
        uint128 pythFeeInWei,
        address defaultProvider,
        address pythAddress,
        bool prefillRequestStorage
    ) internal {
        require(admin != address(0), "admin is zero address");
        require(
            defaultProvider != address(0),
            "defaultProvider is zero address"
        );
        require(pythAddress != address(0), "pyth is zero address");

        _state.admin = admin;
        _state.accruedPythFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
        _state.defaultProvider = defaultProvider;
        _state.pyth = pythAddress;

        if (prefillRequestStorage) {
            // Write some data to every storage slot in the requests array such that new requests
            // use a more consistent amount of gas.
            // Note that these requests are not live because their sequenceNumber is 0.
            for (uint8 i = 0; i < NUM_REQUESTS; i++) {
                Request storage req = _state.requests[i];
                req.sequenceNumber = 0; // Keep it inactive
                req.publishTime = 1;
                // No need to prefill dynamic arrays (priceIds, updateData)
                req.callbackGasLimit = 1;
                req.requester = address(1);
            }
        }
    }

    function register(
        uint128 feeInWei,
        uint128 feePerGas,
        bytes calldata uri
    ) public override {
        ProviderInfo storage providerInfo = _state.providers[msg.sender];

        providerInfo.feeInWei = feeInWei;
        providerInfo.feePerGas = feePerGas;
        providerInfo.uri = uri;
        providerInfo.sequenceNumber += 1;

        emit ProviderRegistered(providerInfo);
    }

    function withdraw(uint128 amount) public override {
        ProviderInfo storage providerInfo = _state.providers[msg.sender];

        // Use checks-effects-interactions pattern to prevent reentrancy attacks.
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

        // Use checks-effects-interactions pattern to prevent reentrancy attacks.
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

    function requestPriceUpdatesWithCallback(
        address provider,
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable override returns (uint64 requestSequenceNumber) {
        ProviderInfo storage providerInfo = _state.providers[provider];
        if (providerInfo.sequenceNumber == 0) revert NoSuchProvider();

        if (
            providerInfo.maxNumPrices > 0 &&
            priceIds.length > providerInfo.maxNumPrices
        ) {
            revert ExceedsMaxPrices(
                uint32(priceIds.length),
                providerInfo.maxNumPrices
            );
        }

        // Assign sequence number and increment
        requestSequenceNumber = providerInfo.sequenceNumber++;

        // Verify fee payment
        uint128 requiredFee = getFee(provider, callbackGasLimit);
        if (msg.value < requiredFee) revert InsufficientFee();

        // Store request for callback execution
        Request storage req = allocRequest(provider, requestSequenceNumber);
        req.provider = provider;
        req.sequenceNumber = requestSequenceNumber;
        req.publishTime = publishTime;
        req.priceIds = priceIds;
        req.callbackGasLimit = callbackGasLimit;
        req.requester = msg.sender;

        // Update fee balances
        providerInfo.accruedFeesInWei += providerInfo.feeInWei;
        _state.accruedPythFeesInWei +=
            SafeCast.toUint128(msg.value) -
            providerInfo.feeInWei;

        emit PriceUpdateRequested(req);
    }

    function executeCallback(
        address provider,
        uint64 sequenceNumber,
        bytes32[] calldata priceIds,
        bytes[] calldata updateData,
        uint256 callbackGasLimit
    ) external payable override {
        Request storage req = findActiveRequest(provider, sequenceNumber);

        if (
            keccak256(abi.encode(req.priceIds)) !=
            keccak256(abi.encode(priceIds))
        ) {
            revert InvalidPriceIds(priceIds, req.priceIds);
        }

        if (req.callbackGasLimit != callbackGasLimit) {
            revert InvalidCallbackGasLimit(
                callbackGasLimit,
                req.callbackGasLimit
            );
        }

        PythStructs.PriceFeed[] memory priceFeeds = IPyth(_state.pyth)
            .parsePriceFeedUpdates(
                updateData,
                priceIds,
                SafeCast.toUint64(req.publishTime),
                SafeCast.toUint64(req.publishTime)
            );

        uint256 publishTime = priceFeeds[0].price.publishTime;

        try
            IPulseConsumer(req.requester).pulseCallback(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds
            )
        {
            // Callback succeeded
            emitPriceUpdate(
                sequenceNumber,
                msg.sender,
                publishTime,
                priceIds,
                priceFeeds
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

    function emitPriceUpdate(
        uint64 sequenceNumber,
        address provider,
        uint256 publishTime,
        bytes32[] memory priceIds,
        PythStructs.PriceFeed[] memory priceFeeds
    ) internal {
        int64[] memory prices = new int64[](priceFeeds.length);
        uint64[] memory conf = new uint64[](priceFeeds.length);
        int32[] memory expos = new int32[](priceFeeds.length);
        uint256[] memory publishTimes = new uint256[](priceFeeds.length);

        for (uint i = 0; i < priceFeeds.length; i++) {
            prices[i] = priceFeeds[i].price.price;
            conf[i] = priceFeeds[i].price.conf;
            expos[i] = priceFeeds[i].price.expo;
            publishTimes[i] = priceFeeds[i].price.publishTime;
        }

        emit PriceUpdateExecuted(
            sequenceNumber,
            provider,
            publishTime,
            priceIds,
            prices,
            conf,
            expos,
            publishTimes
        );
    }

    function getProviderInfo(
        address provider
    ) public view override returns (ProviderInfo memory info) {
        info = _state.providers[provider];
    }

    function getDefaultProvider()
        public
        view
        override
        returns (address provider)
    {
        provider = _state.defaultProvider;
    }

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) public view override returns (Request memory req) {
        req = findRequest(provider, sequenceNumber);
    }

    function getFee(
        address provider,
        uint256 callbackGasLimit
    ) public view override returns (uint128 feeAmount) {
        ProviderInfo storage providerInfo = _state.providers[provider];
        feeAmount =
            providerInfo.feeInWei +
            (providerInfo.feePerGas * uint128(callbackGasLimit)) +
            _state.pythFeeInWei;
    }

    function getPythFeeInWei()
        public
        view
        override
        returns (uint128 pythFeeInWei)
    {
        pythFeeInWei = _state.pythFeeInWei;
    }

    function getAccruedPythFees()
        public
        view
        override
        returns (uint128 accruedPythFeesInWei)
    {
        accruedPythFeesInWei = _state.accruedPythFeesInWei;
    }

    // Set provider fee. It will revert if provider is not registered.
    function setProviderFee(uint128 newFeeInWei) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];

        if (provider.sequenceNumber == 0) {
            revert NoSuchProvider();
        }
        uint128 oldFeeInWei = provider.feeInWei;
        provider.feeInWei = newFeeInWei;
        emit ProviderFeeUpdated(msg.sender, oldFeeInWei, newFeeInWei);
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

    // Set provider uri. It will revert if provider is not registered.
    function setProviderUri(bytes calldata newUri) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) {
            revert NoSuchProvider();
        }
        bytes memory oldUri = provider.uri;
        provider.uri = newUri;
        emit ProviderUriUpdated(msg.sender, oldUri, newUri);
    }

    function setFeeManager(address manager) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        if (provider.sequenceNumber == 0) {
            revert NoSuchProvider();
        }

        address oldFeeManager = provider.feeManager;
        provider.feeManager = manager;
        emit ProviderFeeManagerUpdated(msg.sender, oldFeeManager, manager);
    }

    function requestKey(
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hash, uint8 shortHash) {
        hash = keccak256(abi.encodePacked(provider, sequenceNumber));
        shortHash = uint8(hash[0] & NUM_REQUESTS_MASK);
    }

    // Find an in-flight active request for given the provider and the sequence number.
    // This method returns a reference to the request, and will revert if the request is
    // not active.
    function findActiveRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (Request storage req) {
        req = findRequest(provider, sequenceNumber);

        // Check there is an active request for the given provider and sequence number.
        if (
            !isActive(req) ||
            req.provider != provider ||
            req.sequenceNumber != sequenceNumber
        ) revert NoSuchRequest();
    }

    // Find an in-flight request.
    // Note that this method can return requests that are not currently active. The caller is responsible for checking
    // that the returned request is active (if they care).
    function findRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (Request storage req) {
        (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);

        req = _state.requests[shortKey];
        if (req.provider == provider && req.sequenceNumber == sequenceNumber) {
            return req;
        } else {
            req = _state.requestsOverflow[key];
        }
    }

    // Clear the storage for an in-flight request, deleting it from the hash table.
    function clearRequest(address provider, uint64 sequenceNumber) internal {
        (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);

        Request storage req = _state.requests[shortKey];
        if (req.provider == provider && req.sequenceNumber == sequenceNumber) {
            req.sequenceNumber = 0;
        } else {
            delete _state.requestsOverflow[key];
        }
    }

    // Allocate storage space for a new in-flight request. This method returns a pointer to a storage slot
    // that the caller should overwrite with the new request. Note that the memory at this storage slot may
    // -- and will -- be filled with arbitrary values, so the caller *must* overwrite every field of the returned
    // struct.
    function allocRequest(
        address provider,
        uint64 sequenceNumber
    ) internal returns (Request storage req) {
        (, uint8 shortKey) = requestKey(provider, sequenceNumber);

        req = _state.requests[shortKey];
        if (isActive(req)) {
            // There's already a prior active request in the storage slot we want to use.
            // Overflow the prior request to the requestsOverflow mapping.
            // It is important that this code overflows the *prior* request to the mapping, and not the new request.
            // There is a chance that some requests never get revealed and remain active forever. We do not want such
            // requests to fill up all of the space in the array and cause all new requests to incur the higher gas cost
            // of the mapping.
            //
            // This operation is expensive, but should be rare. If overflow happens frequently, increase
            // the size of the requests array to support more concurrent active requests.
            (bytes32 reqKey, ) = requestKey(req.provider, req.sequenceNumber);
            _state.requestsOverflow[reqKey] = req;
        }
    }

    // Returns true if a request is active, i.e., its corresponding price update has not yet been executed.
    function isActive(Request storage req) internal view returns (bool) {
        // Note that a provider's initial registration occupies sequence number 0, so there is no way to construct
        // a price update request with sequence number 0.
        return req.sequenceNumber != 0;
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
}
