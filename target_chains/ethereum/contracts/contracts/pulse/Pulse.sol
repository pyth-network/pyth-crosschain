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
        address pythAddress,
        address defaultProvider,
        bool prefillRequestStorage,
        uint256 exclusivityPeriodSeconds
    ) internal {
        require(admin != address(0), "admin is zero address");
        require(pythAddress != address(0), "pyth is zero address");
        require(
            defaultProvider != address(0),
            "defaultProvider is zero address"
        );

        _state.admin = admin;
        _state.accruedFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
        _state.pyth = pythAddress;
        _state.currentSequenceNumber = 1;

        // Two-step initialization process:
        // 1. Set the default provider address here
        // 2. Provider must call registerProvider() in a separate transaction to set their fee
        // This ensures the provider maintains control over their own fee settings
        _state.defaultProvider = defaultProvider;
        _state.exclusivityPeriodSeconds = exclusivityPeriodSeconds;

        if (prefillRequestStorage) {
            for (uint8 i = 0; i < NUM_REQUESTS; i++) {
                Request storage req = _state.requests[i];
                req.sequenceNumber = 0;
                req.publishTime = 1;
                req.callbackGasLimit = 1;
                req.requester = address(1);
                req.numPriceIds = 0;
                // Pre-warm the priceIds array storage
                for (uint8 j = 0; j < MAX_PRICE_IDS; j++) {
                    req.priceIds[j] = bytes32(0);
                }
            }
        }
    }

    function requestPriceUpdatesWithCallback(
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable override returns (uint64 requestSequenceNumber) {
        address provider = _state.defaultProvider;
        require(
            _state.providers[provider].isRegistered,
            "Provider not registered"
        );

        // NOTE: The 60-second future limit on publishTime prevents a DoS vector where
        //      attackers could submit many low-fee requests for far-future updates when gas prices
        //      are low, forcing executors to fulfill them later when gas prices might be much higher.
        //      Since tx.gasprice is used to calculate fees, allowing far-future requests would make
        //      the fee estimation unreliable.
        require(publishTime <= block.timestamp + 60, "Too far in future");
        if (priceIds.length > MAX_PRICE_IDS) {
            revert TooManyPriceIds(priceIds.length, MAX_PRICE_IDS);
        }
        requestSequenceNumber = _state.currentSequenceNumber++;

        uint128 requiredFee = getFee(callbackGasLimit);
        if (msg.value < requiredFee) revert InsufficientFee();

        Request storage req = allocRequest(requestSequenceNumber);
        req.sequenceNumber = requestSequenceNumber;
        req.publishTime = publishTime;
        req.callbackGasLimit = callbackGasLimit;
        req.requester = msg.sender;
        req.numPriceIds = uint8(priceIds.length);
        req.provider = provider;

        // Copy price IDs to storage
        for (uint8 i = 0; i < priceIds.length; i++) {
            req.priceIds[i] = priceIds[i];
        }

        _state.providers[provider].accruedFeesInWei += SafeCast.toUint128(
            msg.value - _state.pythFeeInWei
        );
        _state.accruedFeesInWei += _state.pythFeeInWei;

        emit PriceUpdateRequested(req, priceIds);
    }

    function executeCallback(
        uint64 sequenceNumber,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external payable override {
        Request storage req = findActiveRequest(sequenceNumber);

        // Check provider exclusivity using configurable period
        if (
            block.timestamp < req.publishTime + _state.exclusivityPeriodSeconds
        ) {
            require(
                msg.sender == req.provider,
                "Only assigned provider during exclusivity period"
            );
        }

        // Verify priceIds match
        require(
            priceIds.length == req.numPriceIds,
            "Price IDs length mismatch"
        );
        for (uint8 i = 0; i < req.numPriceIds; i++) {
            if (priceIds[i] != req.priceIds[i]) {
                revert InvalidPriceIds(priceIds[i], req.priceIds[i]);
            }
        }

        // Parse price feeds first to measure gas usage
        PythStructs.PriceFeed[] memory priceFeeds = IPyth(_state.pyth)
            .parsePriceFeedUpdates(
                updateData,
                priceIds,
                SafeCast.toUint64(req.publishTime),
                SafeCast.toUint64(req.publishTime)
            );

        clearRequest(sequenceNumber);

        try
            IPulseConsumer(req.requester).pulseCallback{
                gas: req.callbackGasLimit
            }(sequenceNumber, priceFeeds)
        {
            // Callback succeeded
            emitPriceUpdate(sequenceNumber, priceIds, priceFeeds);
        } catch Error(string memory reason) {
            // Explicit revert/require
            emit PriceUpdateCallbackFailed(
                sequenceNumber,
                msg.sender,
                priceIds,
                req.requester,
                reason
            );
        } catch {
            // Out of gas or other low-level errors
            emit PriceUpdateCallbackFailed(
                sequenceNumber,
                msg.sender,
                priceIds,
                req.requester,
                "low-level error (possibly out of gas)"
            );
        }
    }

    function emitPriceUpdate(
        uint64 sequenceNumber,
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
            msg.sender,
            priceIds,
            prices,
            conf,
            expos,
            publishTimes
        );
    }

    function getFee(
        uint256 callbackGasLimit
    ) public view override returns (uint128 feeAmount) {
        uint128 baseFee = _state.pythFeeInWei; // Fixed fee to Pyth
        uint128 providerFeeInWei = _state
            .providers[_state.defaultProvider]
            .feeInWei; // Provider's per-gas rate
        uint256 gasFee = callbackGasLimit * providerFeeInWei; // Total provider fee based on gas
        feeAmount = baseFee + SafeCast.toUint128(gasFee); // Total fee user needs to pay
    }

    function getPythFeeInWei()
        public
        view
        override
        returns (uint128 pythFeeInWei)
    {
        pythFeeInWei = _state.pythFeeInWei;
    }

    function getAccruedFees()
        public
        view
        override
        returns (uint128 accruedFeesInWei)
    {
        accruedFeesInWei = _state.accruedFeesInWei;
    }

    function getRequest(
        uint64 sequenceNumber
    ) public view override returns (Request memory req) {
        req = findRequest(sequenceNumber);
    }

    function requestKey(
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hash, uint8 shortHash) {
        hash = keccak256(abi.encodePacked(sequenceNumber));
        shortHash = uint8(hash[0] & NUM_REQUESTS_MASK);
    }

    function withdrawFees(uint128 amount) external {
        require(msg.sender == _state.admin, "Only admin can withdraw fees");
        require(_state.accruedFeesInWei >= amount, "Insufficient balance");

        _state.accruedFeesInWei -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send fees");

        emit FeesWithdrawn(msg.sender, amount);
    }

    function findActiveRequest(
        uint64 sequenceNumber
    ) internal view returns (Request storage req) {
        req = findRequest(sequenceNumber);

        if (!isActive(req) || req.sequenceNumber != sequenceNumber)
            revert NoSuchRequest();
    }

    function findRequest(
        uint64 sequenceNumber
    ) internal view returns (Request storage req) {
        (bytes32 key, uint8 shortKey) = requestKey(sequenceNumber);

        req = _state.requests[shortKey];
        if (req.sequenceNumber == sequenceNumber) {
            return req;
        } else {
            req = _state.requestsOverflow[key];
        }
    }

    function clearRequest(uint64 sequenceNumber) internal {
        (bytes32 key, uint8 shortKey) = requestKey(sequenceNumber);

        Request storage req = _state.requests[shortKey];
        if (req.sequenceNumber == sequenceNumber) {
            req.sequenceNumber = 0;
        } else {
            delete _state.requestsOverflow[key];
        }
    }

    function allocRequest(
        uint64 sequenceNumber
    ) internal returns (Request storage req) {
        (, uint8 shortKey) = requestKey(sequenceNumber);

        req = _state.requests[shortKey];
        if (isActive(req)) {
            (bytes32 reqKey, ) = requestKey(req.sequenceNumber);
            _state.requestsOverflow[reqKey] = req;
        }
    }

    function isActive(Request storage req) internal view returns (bool) {
        return req.sequenceNumber != 0;
    }

    function setFeeManager(address manager) external override {
        require(
            _state.providers[msg.sender].isRegistered,
            "Provider not registered"
        );
        address oldFeeManager = _state.providers[msg.sender].feeManager;
        _state.providers[msg.sender].feeManager = manager;
        emit FeeManagerUpdated(msg.sender, oldFeeManager, manager);
    }

    function withdrawAsFeeManager(
        address provider,
        uint128 amount
    ) external override {
        require(
            msg.sender == _state.providers[provider].feeManager,
            "Only fee manager"
        );
        require(
            _state.providers[provider].accruedFeesInWei >= amount,
            "Insufficient balance"
        );

        _state.providers[provider].accruedFeesInWei -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send fees");

        emit FeesWithdrawn(msg.sender, amount);
    }

    function registerProvider(uint128 feeInWei) external override {
        ProviderInfo storage provider = _state.providers[msg.sender];
        require(!provider.isRegistered, "Provider already registered");
        provider.feeInWei = feeInWei;
        provider.isRegistered = true;
        emit ProviderRegistered(msg.sender, feeInWei);
    }

    function setProviderFee(uint128 newFeeInWei) external override {
        require(
            _state.providers[msg.sender].isRegistered,
            "Provider not registered"
        );
        uint128 oldFee = _state.providers[msg.sender].feeInWei;
        _state.providers[msg.sender].feeInWei = newFeeInWei;
        emit ProviderFeeUpdated(msg.sender, oldFee, newFeeInWei);
    }

    function getProviderInfo(
        address provider
    ) external view override returns (ProviderInfo memory) {
        return _state.providers[provider];
    }

    function getDefaultProvider() external view override returns (address) {
        return _state.defaultProvider;
    }

    function setDefaultProvider(address provider) external override {
        require(
            msg.sender == _state.admin,
            "Only admin can set default provider"
        );
        require(
            _state.providers[provider].isRegistered,
            "Provider not registered"
        );
        address oldProvider = _state.defaultProvider;
        _state.defaultProvider = provider;
        emit DefaultProviderUpdated(oldProvider, provider);
    }

    function setExclusivityPeriod(uint256 periodSeconds) external override {
        require(
            msg.sender == _state.admin,
            "Only admin can set exclusivity period"
        );
        uint256 oldPeriod = _state.exclusivityPeriodSeconds;
        _state.exclusivityPeriodSeconds = periodSeconds;
        emit ExclusivityPeriodUpdated(oldPeriod, periodSeconds);
    }

    function getExclusivityPeriod() external view override returns (uint256) {
        return _state.exclusivityPeriodSeconds;
    }
}
