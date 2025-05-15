// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyEvents.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@nomad-xyz/excessively-safe-call/src/ExcessivelySafeCall.sol";
import "./EntropyState.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStatusConstants.sol";
import "./EntropyStructConverter.sol";

// Entropy implements a secure 2-party random number generation procedure. The protocol
// is an extension of a simple commit/reveal protocol. The original version has the following steps:
//
// 1. Two parties A and B each randomly sample a contribution x_{A,B} to the random number
// 2. A commits to their number by sharing h_A = hash(x_A)
// 3. B reveals x_B
// 4. A reveals x_A
// 5. B verifies that hash(x_{A}) == h_A
// 6. The random number r = hash(x_A, x_B)
//
// This protocol has the property that the result is random as long as either A or B are honest.
// Honesty means that (1) they draw their value at random, and (2) for A, they keep x_A a secret until
// step 4. Thus, neither party needs to trust the other -- as long as they are themselves honest, they can
// ensure that the result r is random.
//
// Entropy implements a version of this protocol that is optimized for on-chain usage. The
// key difference is that one of the participants (the provider) commits to a sequence of random numbers
// up-front using a hash chain. Users of the protocol then simply grab the next random number in the sequence.
//
// Setup: The provider P computes a sequence of N random numbers, x_i (i = 0...N-1):
// x_{N-1} = random()
// x_i = hash(x_{i + 1})
// The provider commits to x_0 by posting it to the contract. Each random number in the sequence can then be
// verified against the previous one in the sequence by hashing it, i.e., hash(x_i) == x_{i - 1}
//
// Request: To produce a random number, the following steps occur.
// 1. The user randomly samples their contribution x_U and submits it to the contract
// 2. The contract remembers x_U and assigns it an incrementing sequence number i, representing which
//    of the provider's random numbers the user will receive.
// 3. The provider submits a transaction to the contract revealing their contribution x_i to the contract.
// 4. The contract verifies hash(x_i) == x_{i-1} to prove that x_i is the i'th random number.
//    The contract stores x_i as the i'th random number to reuse for future verifications.
// 5. If the condition above is satisfied, the random number r = hash(x_i, x_U).
// 6. The contract submits a callback to the calling contract with the random number `r`.
//
// This protocol has the same security properties as the 2-party randomness protocol above: as long as either
// the provider or user is honest, the number r is random. Note that this analysis assumes that
// providers cannot frontrun user transactions -- a dishonest provider who frontruns user transaction can
// manipulate the result.
//
// The Entropy implementation of the above protocol allows anyone to permissionlessly register to be a
// randomness provider. Users then choose which provider to request randomness from. Each provider can set
// their own fee for the service. In addition, the Entropy contract charges a flat fee that goes to the
// Pyth protocol for each requested random number. Fees are paid in the native token of the network.
//
// This implementation has two intricacies that merit further explanation. First, the implementation supports
// multiple concurrent requests for randomness by checking the provider's random number against their last known
// random number. Verification therefore may require computing multiple hashes (~ the number of concurrent requests).
// Second, the implementation allows providers to rotate their commitment at any time. This operation allows
// providers to commit to additional random numbers once they reach the end of their initial sequence, or rotate out
// a compromised sequence. On rotation, any in-flight requests continue to use the pre-rotation commitment.
// Providers can use the sequence number of the request along with the event log of their registrations to determine
// which hash chain contains the requested random number.
abstract contract Entropy is IEntropy, EntropyState {
    using ExcessivelySafeCall for address;

    uint32 public constant TEN_THOUSAND = 10000;
    uint32 public constant MAX_GAS_LIMIT =
        uint32(type(uint16).max) * TEN_THOUSAND;

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
        _state.accruedPythFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
        _state.defaultProvider = defaultProvider;

        if (prefillRequestStorage) {
            // Write some data to every storage slot in the requests array such that new requests
            // use a more consistent amount of gas.
            // Note that these requests are not live because their sequenceNumber is 0.
            for (uint8 i = 0; i < NUM_REQUESTS; i++) {
                EntropyStructsV2.Request storage req = _state.requests[i];
                req.provider = address(1);
                req.blockNumber = 1234;
                req.commitment = hex"0123";
            }
        }
    }

    // Register msg.sender as a randomness provider. The arguments are the provider's configuration parameters
    // and initial commitment. Re-registering the same provider rotates the provider's commitment (and updates
    // the feeInWei).
    //
    // chainLength is the number of values in the hash chain *including* the commitment, that is, chainLength >= 1.
    function register(
        uint128 feeInWei,
        bytes32 commitment,
        bytes calldata commitmentMetadata,
        uint64 chainLength,
        bytes calldata uri
    ) public override {
        if (chainLength == 0) revert EntropyErrors.AssertionFailure();

        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];

        // NOTE: this method implementation depends on the fact that ProviderInfo will be initialized to all-zero.
        // Specifically, accruedFeesInWei is intentionally not set. On initial registration, it will be zero,
        // then on future registrations, it will be unchanged. Similarly, provider.sequenceNumber defaults to 0
        // on initial registration.

        provider.feeInWei = feeInWei;

        provider.originalCommitment = commitment;
        provider.originalCommitmentSequenceNumber = provider.sequenceNumber;
        provider.currentCommitment = commitment;
        provider.currentCommitmentSequenceNumber = provider.sequenceNumber;
        provider.commitmentMetadata = commitmentMetadata;
        provider.endSequenceNumber = provider.sequenceNumber + chainLength;
        provider.uri = uri;

        provider.sequenceNumber += 1;

        emit EntropyEvents.Registered(
            EntropyStructConverter.toV1ProviderInfo(provider)
        );
        emit EntropyEventsV2.Registered(msg.sender, bytes(""));
    }

    // Withdraw a portion of the accumulated fees for the provider msg.sender.
    // Calling this function will transfer `amount` wei to the caller (provided that they have accrued a sufficient
    // balance of fees in the contract).
    function withdraw(uint128 amount) public override {
        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            msg.sender
        ];

        // Use checks-effects-interactions pattern to prevent reentrancy attacks.
        require(
            providerInfo.accruedFeesInWei >= amount,
            "Insufficient balance"
        );
        providerInfo.accruedFeesInWei -= amount;

        // Interaction with an external contract or token transfer
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "withdrawal to msg.sender failed");

        emit EntropyEvents.Withdrawal(msg.sender, msg.sender, amount);
        emit EntropyEventsV2.Withdrawal(
            msg.sender,
            msg.sender,
            amount,
            bytes("")
        );
    }

    function withdrawAsFeeManager(
        address provider,
        uint128 amount
    ) external override {
        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];

        if (providerInfo.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }

        if (providerInfo.feeManager != msg.sender) {
            revert EntropyErrors.Unauthorized();
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

        emit EntropyEvents.Withdrawal(provider, msg.sender, amount);
        emit EntropyEventsV2.Withdrawal(
            provider,
            msg.sender,
            amount,
            bytes("")
        );
    }

    // requestHelper allocates and returns a new request for the given provider.
    // Note: This method will revert unless the caller provides a sufficient fee
    // (at least getFee(provider)) as msg.value.
    function requestHelper(
        address provider,
        bytes32 userCommitment,
        bool useBlockhash,
        bool isRequestWithCallback,
        uint32 callbackGasLimit
    ) internal returns (EntropyStructsV2.Request storage req) {
        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];
        if (_state.providers[provider].sequenceNumber == 0)
            revert EntropyErrors.NoSuchProvider();

        // Assign a sequence number to the request
        uint64 assignedSequenceNumber = providerInfo.sequenceNumber;
        if (assignedSequenceNumber >= providerInfo.endSequenceNumber)
            revert EntropyErrors.OutOfRandomness();
        providerInfo.sequenceNumber += 1;

        // Check that fees were paid and increment the pyth / provider balances.
        uint128 requiredFee = getFeeV2(provider, callbackGasLimit);
        if (msg.value < requiredFee) revert EntropyErrors.InsufficientFee();
        uint128 providerFee = getProviderFee(provider, callbackGasLimit);
        providerInfo.accruedFeesInWei += providerFee;
        _state.accruedPythFeesInWei += (SafeCast.toUint128(msg.value) -
            providerFee);

        // Store the user's commitment so that we can fulfill the request later.
        // Warning: this code needs to overwrite *every* field in the request, because the returned request can be
        // filled with arbitrary data.
        req = allocRequest(provider, assignedSequenceNumber);
        req.provider = provider;
        req.sequenceNumber = assignedSequenceNumber;
        req.numHashes = SafeCast.toUint32(
            assignedSequenceNumber -
                providerInfo.currentCommitmentSequenceNumber
        );
        if (
            providerInfo.maxNumHashes != 0 &&
            req.numHashes > providerInfo.maxNumHashes
        ) {
            revert EntropyErrors.LastRevealedTooOld();
        }
        req.commitment = keccak256(
            bytes.concat(userCommitment, providerInfo.currentCommitment)
        );
        req.requester = msg.sender;

        req.blockNumber = SafeCast.toUint64(block.number);
        req.useBlockhash = useBlockhash;

        req.callbackStatus = isRequestWithCallback
            ? EntropyStatusConstants.CALLBACK_NOT_STARTED
            : EntropyStatusConstants.CALLBACK_NOT_NECESSARY;
        if (providerInfo.defaultGasLimit == 0) {
            // Provider doesn't support the new callback failure state flow (toggled by setting the gas limit field).
            // Set gasLimit10k to 0 to disable.
            req.gasLimit10k = 0;
        } else {
            // This check does two important things:
            // 1. Providers have a minimum fee set for their defaultGasLimit. If users request less gas than that,
            //    they still pay for the full gas limit. So we may as well give them the full limit here.
            // 2. If a provider has a defaultGasLimit != 0, we need to ensure that all requests have a >0 gas limit
            //    so that we opt-in to the new callback failure state flow.
            req.gasLimit10k = roundTo10kGas(
                callbackGasLimit < providerInfo.defaultGasLimit
                    ? providerInfo.defaultGasLimit
                    : callbackGasLimit
            );
        }
    }

    function requestV2()
        external
        payable
        override
        returns (uint64 assignedSequenceNumber)
    {
        assignedSequenceNumber = requestV2(getDefaultProvider(), random(), 0);
    }

    function requestV2(
        uint32 gasLimit
    ) external payable override returns (uint64 assignedSequenceNumber) {
        assignedSequenceNumber = requestV2(
            getDefaultProvider(),
            random(),
            gasLimit
        );
    }

    function requestV2(
        address provider,
        uint32 gasLimit
    ) external payable override returns (uint64 assignedSequenceNumber) {
        assignedSequenceNumber = requestV2(provider, random(), gasLimit);
    }

    // As a user, request a random number from `provider`. Prior to calling this method, the user should
    // generate a random number x and keep it secret. The user should then compute hash(x) and pass that
    // as the userCommitment argument. (You may call the constructUserCommitment method to compute the hash.)
    //
    // This method returns a sequence number. The user should pass this sequence number to
    // their chosen provider (the exact method for doing so will depend on the provider) to retrieve the provider's
    // number. The user should then call fulfillRequest to construct the final random number.
    //
    // This method will revert unless the caller provides a sufficient fee (at least getFee(provider)) as msg.value.
    // Note that excess value is *not* refunded to the caller.
    function request(
        address provider,
        bytes32 userCommitment,
        bool useBlockHash
    ) public payable override returns (uint64 assignedSequenceNumber) {
        EntropyStructsV2.Request storage req = requestHelper(
            provider,
            userCommitment,
            useBlockHash,
            false,
            0
        );
        assignedSequenceNumber = req.sequenceNumber;
        emit Requested(EntropyStructConverter.toV1Request(req));
    }

    // Request a random number. The method expects the provider address and a secret random number
    // in the arguments. It returns a sequence number.
    //
    // The address calling this function should be a contract that inherits from the IEntropyConsumer interface.
    // The `entropyCallback` method on that interface will receive a callback with the generated random number.
    //
    // This method will revert unless the caller provides a sufficient fee (at least getFee(provider)) as msg.value.
    // Note that excess value is *not* refunded to the caller.
    function requestWithCallback(
        address provider,
        bytes32 userContribution
    ) public payable override returns (uint64) {
        return
            requestV2(
                provider,
                userContribution,
                0 // Passing 0 will assign the request the provider's default gas limit
            );
    }

    function requestV2(
        address provider,
        bytes32 userContribution,
        uint32 gasLimit
    ) public payable override returns (uint64) {
        EntropyStructsV2.Request storage req = requestHelper(
            provider,
            constructUserCommitment(userContribution),
            // If useBlockHash is set to true, it allows a scenario in which the provider and miner can collude.
            // If we remove the blockHash from this, the provider would have no choice but to provide its committed
            // random number. Hence, useBlockHash is set to false.
            false,
            true,
            gasLimit
        );

        emit RequestedWithCallback(
            provider,
            req.requester,
            req.sequenceNumber,
            userContribution,
            EntropyStructConverter.toV1Request(req)
        );
        emit EntropyEventsV2.Requested(
            provider,
            req.requester,
            req.sequenceNumber,
            userContribution,
            uint32(req.gasLimit10k) * TEN_THOUSAND,
            bytes("")
        );
        return req.sequenceNumber;
    }

    // This method validates the provided user's revelation and provider's revelation against the corresponding
    // commitment in the in-flight request. If both values are validated, this method will update the provider
    // current commitment and returns the generated random number.
    function revealHelper(
        EntropyStructsV2.Request storage req,
        bytes32 userContribution,
        bytes32 providerContribution
    ) internal returns (bytes32 randomNumber, bytes32 blockHash) {
        bytes32 providerCommitment = constructProviderCommitment(
            req.numHashes,
            providerContribution
        );
        bytes32 userCommitment = constructUserCommitment(userContribution);
        if (
            keccak256(bytes.concat(userCommitment, providerCommitment)) !=
            req.commitment
        ) revert EntropyErrors.IncorrectRevelation();

        blockHash = bytes32(uint256(0));
        if (req.useBlockhash) {
            bytes32 _blockHash = blockhash(req.blockNumber);

            // The `blockhash` function will return zero if the req.blockNumber is equal to the current
            // block number, or if it is not within the 256 most recent blocks. This allows the user to
            // select between two random numbers by executing the reveal function in the same block as the
            // request, or after 256 blocks. This gives each user two chances to get a favorable result on
            // each request.
            // Revert this transaction for when the blockHash is 0;
            if (_blockHash == bytes32(uint256(0)))
                revert EntropyErrors.BlockhashUnavailable();

            blockHash = _blockHash;
        }

        randomNumber = combineRandomValues(
            userContribution,
            providerContribution,
            blockHash
        );

        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            req.provider
        ];
        if (providerInfo.currentCommitmentSequenceNumber < req.sequenceNumber) {
            providerInfo.currentCommitmentSequenceNumber = req.sequenceNumber;
            providerInfo.currentCommitment = providerContribution;
        }
    }

    // Advance the provider commitment and increase the sequence number.
    // This is used to reduce the `numHashes` required for future requests which leads to reduced gas usage.
    function advanceProviderCommitment(
        address provider,
        uint64 advancedSequenceNumber,
        bytes32 providerContribution
    ) public override {
        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];
        if (
            advancedSequenceNumber <=
            providerInfo.currentCommitmentSequenceNumber
        ) revert EntropyErrors.UpdateTooOld();
        if (advancedSequenceNumber >= providerInfo.endSequenceNumber)
            revert EntropyErrors.AssertionFailure();

        uint32 numHashes = SafeCast.toUint32(
            advancedSequenceNumber -
                providerInfo.currentCommitmentSequenceNumber
        );
        bytes32 providerCommitment = constructProviderCommitment(
            numHashes,
            providerContribution
        );

        if (providerCommitment != providerInfo.currentCommitment)
            revert EntropyErrors.IncorrectRevelation();

        providerInfo.currentCommitmentSequenceNumber = advancedSequenceNumber;
        providerInfo.currentCommitment = providerContribution;
        if (
            providerInfo.currentCommitmentSequenceNumber >=
            providerInfo.sequenceNumber
        ) {
            // This means the provider called the function with a sequence number that was not yet requested.
            // Providers should never do this and we consider such an implementation flawed.
            // Assuming this is landed on-chain it's better to bump the sequence number and never use that range
            // for future requests. Otherwise, someone can use the leaked revelation to derive favorable random numbers.
            providerInfo.sequenceNumber =
                providerInfo.currentCommitmentSequenceNumber +
                1;
        }
    }

    // Fulfill a request for a random number. This method validates the provided userRandomness and provider's proof
    // against the corresponding commitments in the in-flight request. If both values are validated, this method returns
    // the corresponding random number.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    //
    // This function must be called by the same `msg.sender` that originally requested the random number. This check
    // prevents denial-of-service attacks where another actor front-runs the requester's reveal transaction.
    function reveal(
        address provider,
        uint64 sequenceNumber,
        bytes32 userContribution,
        bytes32 providerContribution
    ) public override returns (bytes32 randomNumber) {
        EntropyStructsV2.Request storage req = findActiveRequest(
            provider,
            sequenceNumber
        );

        if (
            req.callbackStatus != EntropyStatusConstants.CALLBACK_NOT_NECESSARY
        ) {
            revert EntropyErrors.InvalidRevealCall();
        }

        if (req.requester != msg.sender) {
            revert EntropyErrors.Unauthorized();
        }
        bytes32 blockHash;
        (randomNumber, blockHash) = revealHelper(
            req,
            userContribution,
            providerContribution
        );
        emit Revealed(
            EntropyStructConverter.toV1Request(req),
            userContribution,
            providerContribution,
            blockHash,
            randomNumber
        );
        clearRequest(provider, sequenceNumber);
    }

    // Fulfill a request for a random number. This method validates the provided userRandomness
    // and provider's revelation against the corresponding commitment in the in-flight request. If both values are validated
    // and the requestor address is a contract address, this function calls the requester's entropyCallback method with the
    // sequence number, provider address and the random number as arguments. Else if the requestor is an EOA, it won't call it.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    //
    // Anyone can call this method to fulfill a request, but the callback will only be made to the original requester.
    function revealWithCallback(
        address provider,
        uint64 sequenceNumber,
        bytes32 userContribution,
        bytes32 providerContribution
    ) public override {
        EntropyStructsV2.Request storage req = findActiveRequest(
            provider,
            sequenceNumber
        );

        if (
            !(req.callbackStatus ==
                EntropyStatusConstants.CALLBACK_NOT_STARTED ||
                req.callbackStatus == EntropyStatusConstants.CALLBACK_FAILED)
        ) {
            revert EntropyErrors.InvalidRevealCall();
        }

        bytes32 randomNumber;
        (randomNumber, ) = revealHelper(
            req,
            userContribution,
            providerContribution
        );

        // If the request has an explicit gas limit, then run the new callback failure state flow.
        //
        // Requests that haven't been invoked yet will be invoked safely (catching reverts), and
        // any reverts will be reported as an event. Any failing requests move to a failure state
        // at which point they can be recovered. The recovery flow invokes the callback directly
        // (no catching errors) which allows callers to easily see the revert reason.
        if (
            req.gasLimit10k != 0 &&
            req.callbackStatus == EntropyStatusConstants.CALLBACK_NOT_STARTED
        ) {
            req.callbackStatus = EntropyStatusConstants.CALLBACK_IN_PROGRESS;
            bool success;
            bytes memory ret;
            uint256 startingGas = gasleft();
            (success, ret) = req.requester.excessivelySafeCall(
                // Warning: the provided gas limit below is only an *upper bound* on the gas provided to the call.
                // At most 63/64ths of the current context's gas will be provided to a call, which may be less
                // than the indicated gas limit. (See CALL opcode docs here https://www.evm.codes/?fork=cancun#f1)
                // Consequently, out-of-gas reverts need to be handled carefully to ensure that the callback
                // was truly provided with a sufficient amount of gas.
                uint256(req.gasLimit10k) * TEN_THOUSAND,
                256, // copy at most 256 bytes of the return value into ret.
                abi.encodeWithSelector(
                    IEntropyConsumer._entropyCallback.selector,
                    sequenceNumber,
                    provider,
                    randomNumber
                )
            );
            uint32 gasUsed = SafeCast.toUint32(startingGas - gasleft());
            // Reset status to not started here in case the transaction reverts.
            req.callbackStatus = EntropyStatusConstants.CALLBACK_NOT_STARTED;

            if (success) {
                emit RevealedWithCallback(
                    EntropyStructConverter.toV1Request(req),
                    userContribution,
                    providerContribution,
                    randomNumber
                );
                emit EntropyEventsV2.Revealed(
                    provider,
                    req.requester,
                    req.sequenceNumber,
                    randomNumber,
                    userContribution,
                    providerContribution,
                    false,
                    ret,
                    SafeCast.toUint32(gasUsed),
                    bytes("")
                );
                clearRequest(provider, sequenceNumber);
            } else if (
                ret.length > 0 ||
                (startingGas * 31) / 32 >
                uint256(req.gasLimit10k) * TEN_THOUSAND
            ) {
                // The callback reverted for some reason.
                // If ret.length > 0, then we know the callback manually triggered a revert, so it's safe to mark it as failed.
                // If ret.length == 0, then the callback might have run out of gas (though there are other ways to trigger a revert with ret.length == 0).
                // In this case, ensure that the callback was provided with sufficient gas. Technically, 63/64ths of the startingGas is forwarded,
                // but we're using 31/32 to introduce a margin of safety.
                emit CallbackFailed(
                    provider,
                    req.requester,
                    sequenceNumber,
                    userContribution,
                    providerContribution,
                    randomNumber,
                    ret
                );
                emit EntropyEventsV2.Revealed(
                    provider,
                    req.requester,
                    sequenceNumber,
                    randomNumber,
                    userContribution,
                    providerContribution,
                    true,
                    ret,
                    SafeCast.toUint32(gasUsed),
                    bytes("")
                );
                req.callbackStatus = EntropyStatusConstants.CALLBACK_FAILED;
            } else {
                // Callback reverted by (potentially) running out of gas, but the calling context did not have enough gas
                // to run the callback. This is a corner case that can happen due to the nuances of gas passing
                // in calls (see the comment on the call above).
                //
                // (Note that reverting here plays nicely with the estimateGas RPC method, which binary searches for
                // the smallest gas value that causes the transaction to *succeed*. See https://github.com/ethereum/go-ethereum/pull/3587 )
                revert EntropyErrors.InsufficientGas();
            }
        } else {
            // This case uses the checks-effects-interactions pattern to avoid reentry attacks
            address callAddress = req.requester;
            EntropyStructs.Request memory reqV1 = EntropyStructConverter
                .toV1Request(req);
            clearRequest(provider, sequenceNumber);
            // WARNING: DO NOT USE req BELOW HERE AS ITS CONTENTS HAS BEEN CLEARED

            // Check if the requester is a contract account.
            uint len;
            assembly {
                len := extcodesize(callAddress)
            }
            uint256 startingGas = gasleft();
            if (len != 0) {
                IEntropyConsumer(callAddress)._entropyCallback(
                    sequenceNumber,
                    provider,
                    randomNumber
                );
            }
            uint32 gasUsed = SafeCast.toUint32(startingGas - gasleft());

            emit RevealedWithCallback(
                reqV1,
                userContribution,
                providerContribution,
                randomNumber
            );
            emit EntropyEventsV2.Revealed(
                provider,
                callAddress,
                sequenceNumber,
                randomNumber,
                userContribution,
                providerContribution,
                false,
                bytes(""),
                gasUsed,
                bytes("")
            );
        }
    }

    function getProviderInfo(
        address provider
    ) public view override returns (EntropyStructs.ProviderInfo memory info) {
        info = EntropyStructConverter.toV1ProviderInfo(
            _state.providers[provider]
        );
    }

    function getProviderInfoV2(
        address provider
    ) public view override returns (EntropyStructsV2.ProviderInfo memory info) {
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
    ) public view override returns (EntropyStructs.Request memory req) {
        req = EntropyStructConverter.toV1Request(
            findRequest(provider, sequenceNumber)
        );
    }

    function getRequestV2(
        address provider,
        uint64 sequenceNumber
    ) public view override returns (EntropyStructsV2.Request memory req) {
        req = findRequest(provider, sequenceNumber);
    }

    function getFee(
        address provider
    ) public view override returns (uint128 feeAmount) {
        return getFeeV2(provider, 0);
    }

    function getFeeV2() external view override returns (uint128 feeAmount) {
        return getFeeV2(getDefaultProvider(), 0);
    }

    function getFeeV2(
        uint32 gasLimit
    ) external view override returns (uint128 feeAmount) {
        return getFeeV2(getDefaultProvider(), gasLimit);
    }

    function getFeeV2(
        address provider,
        uint32 gasLimit
    ) public view override returns (uint128 feeAmount) {
        return getProviderFee(provider, gasLimit) + _state.pythFeeInWei;
    }

    function getProviderFee(
        address providerAddr,
        uint32 gasLimit
    ) internal view returns (uint128 feeAmount) {
        EntropyStructsV2.ProviderInfo memory provider = _state.providers[
            providerAddr
        ];

        // Providers charge a minimum of their configured feeInWei for every request.
        // Requests using more than the defaultGasLimit get a proportionally scaled fee.
        // This approach may be somewhat simplistic, but it allows us to continue using the
        // existing feeInWei parameter for the callback failure flow instead of defining new
        // configuration values.
        uint32 roundedGasLimit = uint32(roundTo10kGas(gasLimit)) * TEN_THOUSAND;
        if (
            provider.defaultGasLimit > 0 &&
            roundedGasLimit > provider.defaultGasLimit
        ) {
            // This calculation rounds down the fee, which means that users can get some gas in the callback for free.
            // However, the value of the free gas is < 1 wei, which is insignificant.
            uint128 additionalFee = ((roundedGasLimit -
                provider.defaultGasLimit) * provider.feeInWei) /
                provider.defaultGasLimit;
            return provider.feeInWei + additionalFee;
        } else {
            return provider.feeInWei;
        }
    }

    function getPythFee() public view returns (uint128 feeAmount) {
        return _state.pythFeeInWei;
    }

    function getAccruedPythFees()
        public
        view
        override
        returns (uint128 accruedPythFeesInWei)
    {
        return _state.accruedPythFeesInWei;
    }

    // Set provider fee. It will revert if provider is not registered.
    function setProviderFee(uint128 newFeeInWei) external override {
        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];

        if (provider.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }
        uint128 oldFeeInWei = provider.feeInWei;
        provider.feeInWei = newFeeInWei;
        emit ProviderFeeUpdated(msg.sender, oldFeeInWei, newFeeInWei);
        emit EntropyEventsV2.ProviderFeeUpdated(
            msg.sender,
            oldFeeInWei,
            newFeeInWei,
            bytes("")
        );
    }

    function setProviderFeeAsFeeManager(
        address provider,
        uint128 newFeeInWei
    ) external override {
        EntropyStructsV2.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];

        if (providerInfo.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }

        if (providerInfo.feeManager != msg.sender) {
            revert EntropyErrors.Unauthorized();
        }

        uint128 oldFeeInWei = providerInfo.feeInWei;
        providerInfo.feeInWei = newFeeInWei;

        emit ProviderFeeUpdated(provider, oldFeeInWei, newFeeInWei);
        emit EntropyEventsV2.ProviderFeeUpdated(
            provider,
            oldFeeInWei,
            newFeeInWei,
            bytes("")
        );
    }

    // Set provider uri. It will revert if provider is not registered.
    function setProviderUri(bytes calldata newUri) external override {
        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];
        if (provider.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }
        bytes memory oldUri = provider.uri;
        provider.uri = newUri;
        emit ProviderUriUpdated(msg.sender, oldUri, newUri);
        emit EntropyEventsV2.ProviderUriUpdated(
            msg.sender,
            oldUri,
            newUri,
            bytes("")
        );
    }

    function setFeeManager(address manager) external override {
        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];
        if (provider.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }

        address oldFeeManager = provider.feeManager;
        provider.feeManager = manager;
        emit ProviderFeeManagerUpdated(msg.sender, oldFeeManager, manager);
        emit EntropyEventsV2.ProviderFeeManagerUpdated(
            msg.sender,
            oldFeeManager,
            manager,
            bytes("")
        );
    }

    // Set the maximum number of hashes to record in a request. This should be set according to the maximum gas limit
    // the provider supports for callbacks.
    function setMaxNumHashes(uint32 maxNumHashes) external override {
        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];
        if (provider.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }

        uint32 oldMaxNumHashes = provider.maxNumHashes;
        provider.maxNumHashes = maxNumHashes;
        emit ProviderMaxNumHashesAdvanced(
            msg.sender,
            oldMaxNumHashes,
            maxNumHashes
        );
        emit EntropyEventsV2.ProviderMaxNumHashesAdvanced(
            msg.sender,
            oldMaxNumHashes,
            maxNumHashes,
            bytes("")
        );
    }

    // Set the default gas limit for a request.
    function setDefaultGasLimit(uint32 gasLimit) external override {
        EntropyStructsV2.ProviderInfo storage provider = _state.providers[
            msg.sender
        ];
        if (provider.sequenceNumber == 0) {
            revert EntropyErrors.NoSuchProvider();
        }

        // Check that we can round the gas limit into the 10k gas. This reverts
        // if the provided value exceeds the max.
        roundTo10kGas(gasLimit);

        uint32 oldGasLimit = provider.defaultGasLimit;
        provider.defaultGasLimit = gasLimit;
        emit ProviderDefaultGasLimitUpdated(msg.sender, oldGasLimit, gasLimit);
        emit EntropyEventsV2.ProviderDefaultGasLimitUpdated(
            msg.sender,
            oldGasLimit,
            gasLimit,
            bytes("")
        );
    }

    function constructUserCommitment(
        bytes32 userRandomness
    ) public pure override returns (bytes32 userCommitment) {
        userCommitment = keccak256(bytes.concat(userRandomness));
    }

    function combineRandomValues(
        bytes32 userRandomness,
        bytes32 providerRandomness,
        bytes32 blockHash
    ) public pure override returns (bytes32 combinedRandomness) {
        combinedRandomness = keccak256(
            abi.encodePacked(userRandomness, providerRandomness, blockHash)
        );
    }

    // Rounds the provided quantity of gas into units of 10k gas.
    // If gas is not evenly divisible by 10k, rounds up.
    function roundTo10kGas(uint32 gas) internal pure returns (uint16) {
        if (gas > MAX_GAS_LIMIT) {
            revert EntropyErrors.MaxGasLimitExceeded();
        }

        uint32 gas10k = gas / TEN_THOUSAND;
        if (gas10k * TEN_THOUSAND < gas) {
            gas10k += 1;
        }
        // Note: safe cast here should never revert due to the if statement above.
        return SafeCast.toUint16(gas10k);
    }

    // Create a unique key for an in-flight randomness request. Returns both a long key for use in the requestsOverflow
    // mapping and a short key for use in the requests array.
    function requestKey(
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hash, uint8 shortHash) {
        hash = keccak256(abi.encodePacked(provider, sequenceNumber));
        shortHash = uint8(hash[0] & NUM_REQUESTS_MASK);
    }

    // Construct a provider's commitment given their revealed random number and the distance in the hash chain
    // between the commitment and the revealed random number.
    function constructProviderCommitment(
        uint64 numHashes,
        bytes32 revelation
    ) internal pure returns (bytes32 currentHash) {
        currentHash = revelation;
        while (numHashes > 0) {
            currentHash = keccak256(bytes.concat(currentHash));
            numHashes -= 1;
        }
    }

    // Find an in-flight active request for given the provider and the sequence number.
    // This method returns a reference to the request, and will revert if the request is
    // not active.
    function findActiveRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (EntropyStructsV2.Request storage req) {
        req = findRequest(provider, sequenceNumber);

        // Check there is an active request for the given provider and sequence number.
        if (
            !isActive(req) ||
            req.provider != provider ||
            req.sequenceNumber != sequenceNumber
        ) revert EntropyErrors.NoSuchRequest();
    }

    // Find an in-flight request.
    // Note that this method can return requests that are not currently active. The caller is responsible for checking
    // that the returned request is active (if they care).
    function findRequest(
        address provider,
        uint64 sequenceNumber
    ) internal view returns (EntropyStructsV2.Request storage req) {
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

        EntropyStructsV2.Request storage req = _state.requests[shortKey];
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
    ) internal returns (EntropyStructsV2.Request storage req) {
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

    // Returns true if a request is active, i.e., its corresponding random value has not yet been revealed.
    function isActive(
        EntropyStructsV2.Request storage req
    ) internal view returns (bool) {
        // Note that a provider's initial registration occupies sequence number 0, so there is no way to construct
        // a randomness request with sequence number 0.
        return req.sequenceNumber != 0;
    }

    function random() internal returns (bytes32) {
        _state.seed = keccak256(
            abi.encodePacked(
                block.timestamp,
                block.prevrandao,
                msg.sender,
                _state.seed
            )
        );
        return _state.seed;
    }
}
