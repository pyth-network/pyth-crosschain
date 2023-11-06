// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyEvents.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "./EntropyState.sol";

// Entropy implements a secure 2-party random number generation procedure. The protocol
// is an extension of a simple commit/reveal protocol. The original version has the following steps:
//
// 1. Two parties A and B each draw a random number x_{A,B}
// 2. A and B then share h_{A,B} = hash(x_{A,B})
// 3. A and B reveal x_{A,B}
// 4. Both parties verify that hash(x_{A, B}) == h_{A,B}
// 5. The random number r = hash(x_A, x_B)
//
// This protocol has the property that the result is random as long as either A or B are honest.
// Thus, neither party needs to trust the other -- as long as they are themselves honest, they can
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
// 1. The user draws a random number x_U, and submits h_U = hash(x_U) to this contract
// 2. The contract remembers h_U and assigns it an incrementing sequence number i, representing which
//    of the provider's random numbers the user will receive.
// 3. The user submits an off-chain request (e.g. via HTTP) to the provider to reveal the i'th random number.
// 4. The provider checks the on-chain sequence number and ensures it is > i. If it is not, the provider
//    refuses to reveal the ith random number.
// 5. The provider reveals x_i to the user.
// 6. The user submits both the provider's revealed number x_i and their own x_U to the contract.
// 7. The contract verifies hash(x_i) == x_{i-1} to prove that x_i is the i'th random number. The contract also checks that hash(x_U) == h_U.
//    The contract stores x_i as the i'th random number to reuse for future verifications.
// 8. If both of the above conditions are satisfied, the random number r = hash(x_i, x_U).
//    (Optional) as an added security mechanism, this step can further incorporate the blockhash of the request transaction,
//    r = hash(x_i, x_U, blockhash).
//
// This protocol has the same security properties as the 2-party randomness protocol above: as long as either
// the provider or user is honest, the number r is random. Honesty here means that the participant keeps their
// random number x a secret until the revelation phase (step 5) of the protocol. Note that providers need to
// be careful to ensure their off-chain service isn't compromised to reveal the random numbers -- if this occurs,
// then users will be able to influence the random number r.
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
// a compromised sequence. On rotation, any in-flight requests are continue to use the pre-rotation commitment.
// Each commitment has a metadata field that providers can use to determine which commitment a request is for.
// Providers *must* retrieve the metadata for a request from the blockchain itself to prevent user manipulation of this field.
//
// Warning to integrators:
// An important caveat for users of this protocol is that the user can compute the random number r before
// revealing their own number to the contract. This property means that the user can choose to halt the
// protocol prior to the random number being revealed (i.e., prior to step (6) above). Integrators should ensure that
// the user is always incentivized to reveal their random number, and that the protocol has an escape hatch for
// cases where the user chooses not to reveal.
//
// TODOs:
// - governance??
// - correct method access modifiers (public vs external)
// - gas optimizations
// - function to check invariants??
// - need to increment pyth fees if someone transfers funds to the contract via another method
// - off-chain data ERC support?
contract Entropy is IEntropy, EntropyState {
    // TODO: Use an upgradeable proxy
    constructor(uint pythFeeInWei) {
        _state.accruedPythFeesInWei = 0;
        _state.pythFeeInWei = pythFeeInWei;
    }

    // Register msg.sender as a randomness provider. The arguments are the provider's configuration parameters
    // and initial commitment. Re-registering the same provider rotates the provider's commitment (and updates
    // the feeInWei).
    //
    // chainLength is the number of values in the hash chain *including* the commitment, that is, chainLength >= 1.
    function register(
        uint feeInWei,
        bytes32 commitment,
        bytes calldata commitmentMetadata,
        uint64 chainLength
    ) public override {
        if (chainLength == 0) revert EntropyErrors.AssertionFailure();

        EntropyStructs.ProviderInfo storage provider = _state.providers[
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

        provider.sequenceNumber += 1;

        emit Registered(provider);
    }

    // Withdraw a portion of the accumulated fees for the provider msg.sender.
    // Calling this function will transfer `amount` wei to the caller (provided that they have accrued a sufficient
    // balance of fees in the contract).
    function withdraw(uint256 amount) public override {
        EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
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
        EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];
        if (_state.providers[provider].sequenceNumber == 0)
            revert EntropyErrors.NoSuchProvider();

        // Assign a sequence number to the request
        assignedSequenceNumber = providerInfo.sequenceNumber;
        if (assignedSequenceNumber >= providerInfo.endSequenceNumber)
            revert EntropyErrors.OutOfRandomness();
        providerInfo.sequenceNumber += 1;

        // Check that fees were paid and increment the pyth / provider balances.
        uint requiredFee = getFee(provider);
        if (msg.value < requiredFee) revert EntropyErrors.InsufficientFee();
        providerInfo.accruedFeesInWei += providerInfo.feeInWei;
        _state.accruedPythFeesInWei += (msg.value - providerInfo.feeInWei);

        // Store the user's commitment so that we can fulfill the request later.
        EntropyStructs.Request storage req = _state.requests[
            requestKey(provider, assignedSequenceNumber)
        ];
        req.provider = provider;
        req.sequenceNumber = assignedSequenceNumber;
        req.userCommitment = userCommitment;
        req.providerCommitment = providerInfo.currentCommitment;
        req.providerCommitmentSequenceNumber = providerInfo
            .currentCommitmentSequenceNumber;

        if (useBlockHash) {
            req.blockNumber = block.number;
        }

        emit Requested(req);
    }

    // Fulfill a request for a random number. This method validates the provided userRandomness and provider's proof
    // against the corresponding commitments in the in-flight request. If both values are validated, this function returns
    // the corresponding random number.
    //
    // Note that this function can only be called once per in-flight request. Calling this function deletes the stored
    // request information (so that the contract doesn't use a linear amount of storage in the number of requests).
    // If you need to use the returned random number more than once, you are responsible for storing it.
    function reveal(
        address provider,
        uint64 sequenceNumber,
        bytes32 userRandomness,
        bytes32 providerRevelation
    ) public override returns (bytes32 randomNumber) {
        // TODO: do we need to check that this request exists?
        // TODO: this method may need to be authenticated to prevent griefing
        bytes32 key = requestKey(provider, sequenceNumber);
        EntropyStructs.Request storage req = _state.requests[key];
        // This invariant should be guaranteed to hold by the key construction procedure above, but check it
        // explicitly to be extra cautious.
        if (req.sequenceNumber != sequenceNumber)
            revert EntropyErrors.AssertionFailure();

        bool valid = isProofValid(
            req.providerCommitmentSequenceNumber,
            req.providerCommitment,
            sequenceNumber,
            providerRevelation
        );
        if (!valid) revert EntropyErrors.IncorrectProviderRevelation();
        if (constructUserCommitment(userRandomness) != req.userCommitment)
            revert EntropyErrors.IncorrectUserRevelation();

        bytes32 blockHash = bytes32(uint256(0));
        if (req.blockNumber != 0) {
            blockHash = blockhash(req.blockNumber);
        }

        randomNumber = combineRandomValues(
            userRandomness,
            providerRevelation,
            blockHash
        );

        emit Revealed(
            req,
            userRandomness,
            providerRevelation,
            blockHash,
            randomNumber
        );

        delete _state.requests[key];

        EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
            provider
        ];
        if (providerInfo.currentCommitmentSequenceNumber < sequenceNumber) {
            providerInfo.currentCommitmentSequenceNumber = sequenceNumber;
            providerInfo.currentCommitment = providerRevelation;
        }
    }

    function getProviderInfo(
        address provider
    ) public view override returns (EntropyStructs.ProviderInfo memory info) {
        info = _state.providers[provider];
    }

    function getRequest(
        address provider,
        uint64 sequenceNumber
    ) public view override returns (EntropyStructs.Request memory req) {
        bytes32 key = requestKey(provider, sequenceNumber);
        req = _state.requests[key];
    }

    function getFee(
        address provider
    ) public view override returns (uint feeAmount) {
        return _state.providers[provider].feeInWei + _state.pythFeeInWei;
    }

    function getAccruedPythFees()
        public
        view
        override
        returns (uint accruedPythFeesInWei)
    {
        return _state.accruedPythFeesInWei;
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

    // Create a unique key for an in-flight randomness request (to store it in the contract state)
    function requestKey(
        address provider,
        uint64 sequenceNumber
    ) internal pure returns (bytes32 hash) {
        hash = keccak256(abi.encodePacked(provider, sequenceNumber));
    }

    // Validate that revelation at sequenceNumber is the correct value in the hash chain for a provider whose
    // last known revealed random number was lastRevelation at lastSequenceNumber.
    function isProofValid(
        uint64 lastSequenceNumber,
        bytes32 lastRevelation,
        uint64 sequenceNumber,
        bytes32 revelation
    ) internal pure returns (bool valid) {
        if (sequenceNumber <= lastSequenceNumber)
            revert EntropyErrors.AssertionFailure();

        bytes32 currentHash = revelation;
        while (sequenceNumber > lastSequenceNumber) {
            currentHash = keccak256(bytes.concat(currentHash));
            sequenceNumber -= 1;
        }

        valid = currentHash == lastRevelation;
    }
}
