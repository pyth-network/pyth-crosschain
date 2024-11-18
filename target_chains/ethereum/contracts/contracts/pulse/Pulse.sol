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
        bool prefillRequestStorage
    ) internal {
        require(admin != address(0), "admin is zero address");
        require(pythAddress != address(0), "pyth is zero address");

        _state.admin = admin;
        _state.accruedFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
        _state.pyth = pythAddress;
        _state.currentSequenceNumber = 1;

        if (prefillRequestStorage) {
            for (uint8 i = 0; i < NUM_REQUESTS; i++) {
                Request storage req = _state.requests[i];
                req.sequenceNumber = 0;
                req.publishTime = 1;
                req.callbackGasLimit = 1;
                req.requester = address(1);
            }
        }
    }

    function requestPriceUpdatesWithCallback(
        uint256 publishTime,
        bytes32[] calldata priceIds,
        uint256 callbackGasLimit
    ) external payable override returns (uint64 requestSequenceNumber) {
        requestSequenceNumber = _state.currentSequenceNumber++;

        uint128 requiredFee = getFee(callbackGasLimit);
        if (msg.value < requiredFee) revert InsufficientFee();

        Request storage req = allocRequest(requestSequenceNumber);
        req.sequenceNumber = requestSequenceNumber;
        req.publishTime = publishTime;
        req.priceIdsHash = keccak256(abi.encode(priceIds));
        req.callbackGasLimit = callbackGasLimit;
        req.requester = msg.sender;

        _state.accruedFeesInWei += SafeCast.toUint128(msg.value);

        emit PriceUpdateRequested(req);
    }

    function executeCallback(
        uint64 sequenceNumber,
        bytes[] calldata updateData,
        bytes32[] calldata priceIds
    ) external payable override {
        Request storage req = findActiveRequest(sequenceNumber);

        // Verify priceIds match
        bytes32 providedPriceIdsHash = keccak256(abi.encode(priceIds));
        bytes32 storedPriceIdsHash = req.priceIdsHash;
        if (providedPriceIdsHash != storedPriceIdsHash) {
            revert InvalidPriceIds(providedPriceIdsHash, storedPriceIdsHash);
        }

        // Parse price feeds first to measure gas usage
        PythStructs.PriceFeed[] memory priceFeeds = IPyth(_state.pyth)
            .parsePriceFeedUpdates(
                updateData,
                priceIds,
                SafeCast.toUint64(req.publishTime),
                SafeCast.toUint64(req.publishTime)
            );

        // Check if enough gas remains for the callback
        if (gasleft() < req.callbackGasLimit) {
            revert InsufficientGas();
        }

        try
            IPulseConsumer(req.requester).pulseCallback{
                gas: req.callbackGasLimit
            }(sequenceNumber, msg.sender, priceFeeds)
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

        clearRequest(sequenceNumber);
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
        uint128 baseFee = _state.pythFeeInWei;
        uint256 gasFee = callbackGasLimit * tx.gasprice;
        feeAmount = baseFee + SafeCast.toUint128(gasFee);
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
        require(msg.sender == _state.admin, "Only admin can set fee manager");
        address oldFeeManager = _state.feeManager;
        _state.feeManager = manager;
        emit FeeManagerUpdated(_state.admin, oldFeeManager, manager);
    }

    function withdrawAsFeeManager(uint128 amount) external override {
        require(msg.sender == _state.feeManager, "Only fee manager");
        require(_state.accruedFeesInWei >= amount, "Insufficient balance");

        _state.accruedFeesInWei -= amount;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send fees");

        emit FeesWithdrawn(msg.sender, amount);
    }
}
