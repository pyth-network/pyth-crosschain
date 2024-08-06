// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./EntropyStructs.sol";
import "./EntropyErrors.sol";
import "./EntropyEvents.sol";
import "./IEntropy.sol";
import "./IEntropyConsumer.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "./MockEntropyState.sol";

contract MockEntropy is IEntropy, MockEntropyState {
  error NotImplemented();

  function _initialize(
    address admin,
    uint128 pythFeeInWei,
    address defaultProvider,
    bool prefillRequestStorage
  ) internal {
    require(admin != address(0), "admin is zero address");
    require(defaultProvider != address(0), "defaultProvider is zero address");

    _state.admin = admin;
    _state.accruedPythFeesInWei = 0;
    _state.pythFeeInWei = pythFeeInWei;
    _state.defaultProvider = defaultProvider;

    if (prefillRequestStorage) {
      for (uint8 i = 0; i < NUM_REQUESTS; i++) {
        EntropyStructs.Request storage req = _state.requests[i];
        req.provider = address(1);
        req.blockNumber = 1234;
        req.commitment = hex"0123";
      }
    }
  }

  constructor(
    address admin,
    uint128 pythFeeInWei,
    address defaultProvider,
    bool prefillRequestStorage,
    uint128 feeInWei,
    bytes32 commitment,
    bytes memory commitmentMetadata,
    uint64 chainLength,
    bytes memory uri
  ) {
    _initialize(admin, pythFeeInWei, defaultProvider, prefillRequestStorage);

    EntropyStructs.ProviderInfo storage provider = _state.providers[
      defaultProvider
    ];

    provider.feeInWei = feeInWei;
    provider.originalCommitment = commitment;
    provider.originalCommitmentSequenceNumber = provider.sequenceNumber;
    provider.currentCommitment = commitment;
    provider.currentCommitmentSequenceNumber = provider.sequenceNumber;
    provider.commitmentMetadata = commitmentMetadata;
    provider.endSequenceNumber = provider.sequenceNumber + chainLength;
    provider.uri = uri;
    provider.sequenceNumber += 1;

    emit Registered(provider);
  }

  // Not implemented
  function register(
    uint128 feeInWei,
    bytes32 commitment,
    bytes calldata commitmentMetadata,
    uint64 chainLength,
    bytes calldata uri
  ) public override {
    revert NotImplemented();
  }
  function withdraw(uint128 amount) public override {
    EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
      getDefaultProvider()
    ];

    require(providerInfo.accruedFeesInWei >= amount, "Insufficient balance");
    providerInfo.accruedFeesInWei -= amount;

    (bool sent, ) = msg.sender.call{value: amount}("");
    require(sent, "withdrawal to msg.sender failed");

    emit Withdrawal(getDefaultProvider(), msg.sender, amount);
  }

  function withdrawAsFeeManager(
    address provider,
    uint128 amount
  ) external override {
    EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
      provider
    ];

    if (providerInfo.sequenceNumber == 0) {
      revert EntropyErrors.NoSuchProvider();
    }

    if (providerInfo.feeManager != msg.sender) {
      revert EntropyErrors.Unauthorized();
    }

    require(providerInfo.accruedFeesInWei >= amount, "Insufficient balance");
    providerInfo.accruedFeesInWei -= amount;

    (bool sent, ) = msg.sender.call{value: amount}("");
    require(sent, "withdrawal to msg.sender failed");

    emit Withdrawal(provider, msg.sender, amount);
  }

  function requestHelper(
    address provider,
    bytes32 userCommitment,
    bool useBlockhash,
    bool isRequestWithCallback
  ) internal returns (EntropyStructs.Request storage req) {
    EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
      provider
    ];
    if (_state.providers[provider].sequenceNumber == 0)
      revert EntropyErrors.NoSuchProvider();

    uint64 assignedSequenceNumber = providerInfo.sequenceNumber;
    if (assignedSequenceNumber >= providerInfo.endSequenceNumber)
      revert EntropyErrors.OutOfRandomness();
    providerInfo.sequenceNumber += 1;

    uint128 requiredFee = getFee(provider);
    if (msg.value < requiredFee) revert EntropyErrors.InsufficientFee();
    providerInfo.accruedFeesInWei += providerInfo.feeInWei;
    _state.accruedPythFeesInWei += (SafeCast.toUint128(msg.value) -
      providerInfo.feeInWei);

    req = allocRequest(provider, assignedSequenceNumber);
    req.provider = provider;
    req.sequenceNumber = assignedSequenceNumber;
    req.numHashes = SafeCast.toUint32(
      assignedSequenceNumber - providerInfo.currentCommitmentSequenceNumber
    );
    req.commitment = keccak256(
      bytes.concat(userCommitment, providerInfo.currentCommitment)
    );
    req.requester = msg.sender;

    req.blockNumber = SafeCast.toUint64(block.number);
    req.useBlockhash = useBlockhash;
    req.isRequestWithCallback = isRequestWithCallback;
  }

  function request(
    address provider,
    bytes32 userCommitment,
    bool useBlockHash
  ) public payable override returns (uint64 assignedSequenceNumber) {
    EntropyStructs.Request storage req = requestHelper(
      provider,
      userCommitment,
      useBlockHash,
      false
    );
    assignedSequenceNumber = req.sequenceNumber;
    emit Requested(req);
  }

  function requestWithCallback(
    address provider,
    bytes32 userRandomNumber
  ) public payable override returns (uint64) {
    EntropyStructs.Request storage req = requestHelper(
      provider,
      constructUserCommitment(userRandomNumber),
      false,
      true
    );

    emit RequestedWithCallback(
      provider,
      req.requester,
      req.sequenceNumber,
      userRandomNumber,
      req
    );

    return req.sequenceNumber;
  }

  // Not implemented
  function reveal(
    address provider,
    uint64 sequenceNumber,
    bytes32 userRevelation,
    bytes32 providerRevelation
  ) public override returns (bytes32 randomNumber) {
    revert NotImplemented();
  }

  function triggerReveal(
    address provider,
    uint64 sequenceNumber,
    bytes32 userRevelation,
    bytes32 providerRevelation,
    uint256 _randomNumber
  ) public returns (bytes32 randomNumber) {
    EntropyStructs.Request storage req = findActiveRequest(
      provider,
      sequenceNumber
    );

    if (req.isRequestWithCallback) {
      revert EntropyErrors.InvalidRevealCall();
    }

    if (req.requester != msg.sender) {
      revert EntropyErrors.Unauthorized();
    }
    bytes32 blockHash = blockhash(req.blockNumber);
    randomNumber = bytes32(_randomNumber);

    emit Revealed(
      req,
      userRevelation,
      providerRevelation,
      blockHash,
      randomNumber
    );
    clearRequest(provider, sequenceNumber);
  }

  // Not implemented
  function revealWithCallback(
    address provider,
    uint64 sequenceNumber,
    bytes32 userRandomNumber,
    bytes32 providerRevelation
  ) public override {
    revert NotImplemented();
  }

  function triggerRevealWithCallback(
    address provider,
    uint64 sequenceNumber,
    bytes32 userRandomNumber,
    bytes32 providerRevelation,
    uint256 _randomNumber
  ) public {
    EntropyStructs.Request storage req = findActiveRequest(
      provider,
      sequenceNumber
    );

    if (!req.isRequestWithCallback) {
      revert EntropyErrors.InvalidRevealCall();
    }

    address callAddress = req.requester;
    bytes32 randomNumber = bytes32(_randomNumber);
    emit RevealedWithCallback(
      req,
      userRandomNumber,
      providerRevelation,
      randomNumber
    );

    clearRequest(provider, sequenceNumber);

    uint len;
    assembly {
      len := extcodesize(callAddress)
    }
    if (len != 0) {
      IEntropyConsumer(callAddress)._entropyCallback(
        sequenceNumber,
        provider,
        randomNumber
      );
    }
  }

  function getProviderInfo(
    address provider
  ) public view override returns (EntropyStructs.ProviderInfo memory info) {
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
    req = findRequest(provider, sequenceNumber);
  }

  function getFee(
    address provider
  ) public view override returns (uint128 feeAmount) {
    return _state.providers[provider].feeInWei + _state.pythFeeInWei;
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

  function setProviderFee(uint128 newFeeInWei) external override {
    EntropyStructs.ProviderInfo storage provider = _state.providers[
      getDefaultProvider()
    ];

    if (provider.sequenceNumber == 0) {
      revert EntropyErrors.NoSuchProvider();
    }
    uint128 oldFeeInWei = provider.feeInWei;
    provider.feeInWei = newFeeInWei;
    emit ProviderFeeUpdated(getDefaultProvider(), oldFeeInWei, newFeeInWei);
  }

  function setProviderFeeAsFeeManager(
    address provider,
    uint128 newFeeInWei
  ) external override {
    EntropyStructs.ProviderInfo storage providerInfo = _state.providers[
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
  }

  function setProviderUri(bytes calldata newUri) external override {
    EntropyStructs.ProviderInfo storage provider = _state.providers[
      getDefaultProvider()
    ];
    if (provider.sequenceNumber == 0) {
      revert EntropyErrors.NoSuchProvider();
    }
    bytes memory oldUri = provider.uri;
    provider.uri = newUri;
    emit ProviderUriUpdated(getDefaultProvider(), oldUri, newUri);
  }

  function setFeeManager(address manager) external override {
    EntropyStructs.ProviderInfo storage provider = _state.providers[
      getDefaultProvider()
    ];
    if (provider.sequenceNumber == 0) {
      revert EntropyErrors.NoSuchProvider();
    }

    address oldFeeManager = provider.feeManager;
    provider.feeManager = manager;
    emit ProviderFeeManagerUpdated(
      getDefaultProvider(),
      oldFeeManager,
      manager
    );
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

  function constructUserCommitment(
    bytes32 userRandomness
  ) public pure override returns (bytes32 userCommitment) {
    userCommitment = keccak256(bytes.concat(userRandomness));
  }

  function requestKey(
    address provider,
    uint64 sequenceNumber
  ) internal pure returns (bytes32 hash, uint8 shortHash) {
    hash = keccak256(abi.encodePacked(provider, sequenceNumber));
    shortHash = uint8(hash[0] & NUM_REQUESTS_MASK);
  }

  function findActiveRequest(
    address provider,
    uint64 sequenceNumber
  ) internal view returns (EntropyStructs.Request storage req) {
    req = findRequest(provider, sequenceNumber);
    if (
      !isActive(req) ||
      req.provider != provider ||
      req.sequenceNumber != sequenceNumber
    ) revert EntropyErrors.NoSuchRequest();
  }

  function findRequest(
    address provider,
    uint64 sequenceNumber
  ) internal view returns (EntropyStructs.Request storage req) {
    (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);

    req = _state.requests[shortKey];
    if (req.provider == provider && req.sequenceNumber == sequenceNumber) {
      return req;
    } else {
      req = _state.requestsOverflow[key];
    }
  }

  function clearRequest(address provider, uint64 sequenceNumber) internal {
    (bytes32 key, uint8 shortKey) = requestKey(provider, sequenceNumber);

    EntropyStructs.Request storage req = _state.requests[shortKey];
    if (req.provider == provider && req.sequenceNumber == sequenceNumber) {
      req.sequenceNumber = 0;
    } else {
      delete _state.requestsOverflow[key];
    }
  }

  function allocRequest(
    address provider,
    uint64 sequenceNumber
  ) internal returns (EntropyStructs.Request storage req) {
    (, uint8 shortKey) = requestKey(provider, sequenceNumber);

    req = _state.requests[shortKey];
    if (isActive(req)) {
      (bytes32 reqKey, ) = requestKey(req.provider, req.sequenceNumber);
      _state.requestsOverflow[reqKey] = req;
    }
  }

  function isActive(
    EntropyStructs.Request storage req
  ) internal view returns (bool) {
    return req.sequenceNumber != 0;
  }
}
