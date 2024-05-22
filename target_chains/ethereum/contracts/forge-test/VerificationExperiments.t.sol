// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "../contracts/libraries/external/UnsafeBytesLib.sol";
import "@pythnetwork/pyth-sdk-solidity/AbstractPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "../contracts/pyth/PythInternalStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";

// Experiments to measure the gas usage of different ways of verifying prices in the EVM contract.
contract VerificationExperiments is Test, WormholeTestUtils, PythTestUtils {
    // 19, current mainnet number of guardians, is used to have gas estimates
    // close to our mainnet transactions.
    uint8 constant NUM_GUARDIANS = 19;
    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We use 5 prices to form a batch of 5 prices, close to our mainnet transactions.
    uint8 constant NUM_PRICES = 5;

    // Private key for the threshold signature
    uint256 THRESHOLD_KEY = 1234;

    // We will have less than 512 price for a foreseeable future.
    uint8 constant MERKLE_TREE_DEPTH = 9;

    PythExperimental public pyth;

    bytes32[] priceIds;

    // Cached prices are populated in the setUp
    PythStructs.Price[] cachedPrices;
    bytes[] cachedPricesUpdateData;
    uint cachedPricesUpdateFee;
    uint64[] cachedPricesPublishTimes;

    // Fresh prices are different prices that can be used
    // as a fresh price to update the prices
    PythStructs.Price[] freshPrices;
    bytes[] freshPricesUpdateData;
    uint freshPricesUpdateFee;
    uint64[] freshPricesPublishTimes;

    WormholeMerkleUpdate whMerkleUpdateDepth0;
    WormholeMerkleUpdate whMerkleUpdateDepth1;
    WormholeMerkleUpdate whMerkleUpdateDepth8;

    ThresholdMerkleUpdate thresholdMerkleUpdateDepth0;
    ThresholdMerkleUpdate thresholdMerkleUpdateDepth1;
    ThresholdMerkleUpdate thresholdMerkleUpdateDepth8;

    ThresholdUpdate thresholdUpdate;

    bytes nativeUpdate;

    uint64 sequence;

    function setUp() public {
        address payable wormhole = payable(
            setUpWormholeReceiver(NUM_GUARDIANS)
        );

        // Deploy experimental contract
        PythExperimental implementation = new PythExperimental();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            new bytes(0)
        );
        pyth = PythExperimental(address(proxy));

        uint16[] memory emitterChainIds = new uint16[](1);
        emitterChainIds[0] = PythTestUtils.SOURCE_EMITTER_CHAIN_ID;

        bytes32[] memory emitterAddresses = new bytes32[](1);
        emitterAddresses[0] = PythTestUtils.SOURCE_EMITTER_ADDRESS;
        pyth.initialize(
            wormhole,
            vm.addr(THRESHOLD_KEY),
            emitterChainIds,
            emitterAddresses,
            PythTestUtils.GOVERNANCE_EMITTER_CHAIN_ID,
            PythTestUtils.GOVERNANCE_EMITTER_ADDRESS,
            0, // Initial governance sequence
            60, // Valid time period in seconds
            1 // single update fee in wei
        );

        priceIds = new bytes32[](NUM_PRICES);
        priceIds[0] = bytes32(
            0x1000000000000000000000000000000000000000000000000000000000000f00
        );
        for (uint i = 1; i < NUM_PRICES; ++i) {
            priceIds[i] = bytes32(uint256(priceIds[i - 1]) + 1);
        }

        setRandSeed(12345);
        for (uint i = 0; i < NUM_PRICES; ++i) {
            uint64 publishTime = uint64(getRandUint() % 10) + 1; // to make sure prevPublishTime is >= 0

            cachedPrices.push(
                PythStructs.Price(
                    int64(uint64(getRandUint() % 1000)), // Price
                    uint64(getRandUint() % 100), // Confidence
                    -5, // Expo
                    publishTime
                )
            );
            cachedPricesPublishTimes.push(publishTime);

            publishTime += uint64(getRandUint() % 10);
            freshPrices.push(
                PythStructs.Price(
                    int64(uint64(getRandUint() % 1000)), // Price
                    uint64(getRandUint() % 100), // Confidence
                    -5, // Expo
                    publishTime
                )
            );
            freshPricesPublishTimes.push(publishTime);
        }

        // Populate the contract with the initial prices
        (
            cachedPricesUpdateData,
            cachedPricesUpdateFee
        ) = generateWormholeUpdateDataAndFee(cachedPrices);

        pyth.updatePriceFeeds{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData
        );

        (
            freshPricesUpdateData,
            freshPricesUpdateFee
        ) = generateWormholeUpdateDataAndFee(freshPrices);

        // Generate the update payloads for the various verification systems

        whMerkleUpdateDepth0 = generateSingleWhMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            0
        );
        whMerkleUpdateDepth1 = generateSingleWhMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            1
        );
        whMerkleUpdateDepth8 = generateSingleWhMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            8
        );

        thresholdMerkleUpdateDepth0 = generateThresholdMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            0
        );
        thresholdMerkleUpdateDepth1 = generateThresholdMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            1
        );
        thresholdMerkleUpdateDepth8 = generateThresholdMerkleUpdate(
            priceIds[0],
            freshPrices[0],
            8
        );

        thresholdUpdate = generateThresholdUpdate(priceIds[0], freshPrices[0]);

        nativeUpdate = generateMessagePayload(priceIds[0], freshPrices[0]);
    }

    // Get the payload for a wormhole batch price update
    function generateWormholeUpdateDataAndFee(
        PythStructs.Price[] memory prices
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        bytes memory vaa = generateWhMerkleUpdate(
            pricesToPriceFeedMessages(priceIds, prices),
            MERKLE_TREE_DEPTH,
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;

        updateData = new bytes[](1);
        updateData[0] = vaa;

        updateFee = pyth.getUpdateFee(updateData);
    }

    // Helper function to serialize a single price update to bytes.
    // Returns a serialized PriceFeedMessage.
    function generateMessagePayload(
        bytes32 priceId,
        PythStructs.Price memory price
    ) internal returns (bytes memory data) {
        bytes32[] memory messagePriceIds = new bytes32[](1);
        messagePriceIds[0] = priceId;
        PythStructs.Price[] memory prices = new PythStructs.Price[](1);
        prices[0] = price;
        data = encodePriceFeedMessages(
            pricesToPriceFeedMessages(messagePriceIds, prices)
        )[0];

        return data;
    }

    // Helper function to generate a merkle proof of the given depth for the given price.
    // Note: this function assumes that the data is on the leftmost branch of the tree and
    // mocks the rest of the nodes (as the hash of the depth).
    function generateMerkleProof(
        bytes32 priceId,
        PythStructs.Price memory price,
        uint depth
    )
        internal
        returns (bytes32 root, bytes memory data, bytes32[] memory proof)
    {
        data = generateMessagePayload(priceId, price);

        bytes32 curNodeHash = keccak256(data);
        proof = new bytes32[](depth);
        for (uint i = 0; i < depth; ) {
            // pretend the ith sibling is just i
            proof[i] = keccak256(abi.encode(i));
            curNodeHash = keccak256(abi.encode(curNodeHash, proof[i]));

            unchecked {
                i++;
            }
        }

        root = curNodeHash;

        return (root, data, proof);
    }

    // Generate a wormhole-attested merkle proof with the given depth.
    function generateSingleWhMerkleUpdate(
        bytes32 priceId,
        PythStructs.Price memory price,
        uint depth
    ) internal returns (WormholeMerkleUpdate memory update) {
        (
            bytes32 root,
            bytes memory data,
            bytes32[] memory proof
        ) = generateMerkleProof(priceId, price, depth);

        bytes memory rootVaa = generateVaa(
            uint32(block.timestamp),
            PythTestUtils.SOURCE_EMITTER_CHAIN_ID,
            PythTestUtils.SOURCE_EMITTER_ADDRESS,
            sequence,
            bytes.concat(root),
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;

        return WormholeMerkleUpdate(rootVaa, data, proof);
    }

    // Generate a threshold-signed merkle proof with the given depth.
    function generateThresholdMerkleUpdate(
        bytes32 priceId,
        PythStructs.Price memory price,
        uint depth
    ) internal returns (ThresholdMerkleUpdate memory update) {
        (
            bytes32 root,
            bytes memory data,
            bytes32[] memory proof
        ) = generateMerkleProof(priceId, price, depth);

        data = generateMessagePayload(priceId, price);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(THRESHOLD_KEY, root);
        bytes memory signature = abi.encodePacked(r, s, v - 27);

        return ThresholdMerkleUpdate(signature, root, data, proof);
    }

    // Generate a threshold-signed price feed message.
    function generateThresholdUpdate(
        bytes32 priceId,
        PythStructs.Price memory price
    ) internal returns (ThresholdUpdate memory update) {
        bytes memory data = generateMessagePayload(priceId, price);
        bytes32 hash = keccak256(data);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(THRESHOLD_KEY, hash);
        bytes memory signature = abi.encodePacked(r, s, v - 27);

        return ThresholdUpdate(signature, data);
    }

    function testWhBatchUpdate() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee}(
            freshPricesUpdateData
        );
    }

    function testUpdateWhMerkleProofDepth0() public {
        pyth.updatePriceFeedsWhMerkle(
            whMerkleUpdateDepth0.rootVaa,
            whMerkleUpdateDepth0.data,
            whMerkleUpdateDepth0.proof
        );
    }

    function testUpdateWhMerkleProofDepth1() public {
        pyth.updatePriceFeedsWhMerkle(
            whMerkleUpdateDepth1.rootVaa,
            whMerkleUpdateDepth1.data,
            whMerkleUpdateDepth1.proof
        );
    }

    function testUpdateWhMerkleProofDepth8() public {
        pyth.updatePriceFeedsWhMerkle(
            whMerkleUpdateDepth8.rootVaa,
            whMerkleUpdateDepth8.data,
            whMerkleUpdateDepth8.proof
        );
    }

    function testUpdateThresholdMerkleProofDepth0() public {
        pyth.updatePriceFeedsThresholdMerkle(
            thresholdMerkleUpdateDepth0.rootSignature,
            thresholdMerkleUpdateDepth0.rootHash,
            thresholdMerkleUpdateDepth0.data,
            thresholdMerkleUpdateDepth0.proof
        );
    }

    function testUpdateThresholdMerkleProofDepth1() public {
        pyth.updatePriceFeedsThresholdMerkle(
            thresholdMerkleUpdateDepth1.rootSignature,
            thresholdMerkleUpdateDepth1.rootHash,
            thresholdMerkleUpdateDepth1.data,
            thresholdMerkleUpdateDepth1.proof
        );
    }

    function testUpdateThresholdMerkleProofDepth8() public {
        pyth.updatePriceFeedsThresholdMerkle(
            thresholdMerkleUpdateDepth8.rootSignature,
            thresholdMerkleUpdateDepth8.rootHash,
            thresholdMerkleUpdateDepth8.data,
            thresholdMerkleUpdateDepth8.proof
        );
    }

    function testUpdateThreshold() public {
        pyth.updatePriceFeedsThreshold(
            thresholdUpdate.signature,
            thresholdUpdate.data
        );
    }

    function testUpdateNative() public {
        pyth.updatePriceFeedsNative(nativeUpdate);
    }
}

// Pyth contract extended with methods for other verification systems (merkle proofs / threshold signatures)
contract PythExperimental is Pyth {
    address thresholdPublicKey;

    function initialize(
        address wormhole,
        address thresholdPublicKeyArg,
        uint16[] calldata dataSourceEmitterChainIds,
        bytes32[] calldata dataSourceEmitterAddresses,
        uint16 governanceEmitterChainId,
        bytes32 governanceEmitterAddress,
        uint64 governanceInitialSequence,
        uint validTimePeriodSeconds,
        uint singleUpdateFeeInWei
    ) public {
        thresholdPublicKey = thresholdPublicKeyArg;

        Pyth._initialize(
            wormhole,
            dataSourceEmitterChainIds,
            dataSourceEmitterAddresses,
            governanceEmitterChainId,
            governanceEmitterAddress,
            governanceInitialSequence,
            validTimePeriodSeconds,
            singleUpdateFeeInWei
        );
    }

    // Update a single price feed via a wormhole-attested merkle proof.
    // data is expected to be a serialized PriceFeedMessage
    function updatePriceFeedsWhMerkle(
        bytes calldata rootVaa,
        bytes memory data,
        bytes32[] memory proof
    ) public payable {
        IWormhole.VM memory vm = parseAndVerifyBatchMessageVM(rootVaa);
        assert(vm.payload.length == 32);

        bytes32 expectedRoot = UnsafeBytesLib.toBytes32(vm.payload, 0);
        bool validProof = isValidMerkleProof(expectedRoot, data, proof);
        if (!validProof) revert PythErrors.InvalidArgument();

        (
            PythInternalStructs.PriceInfo memory info,
            bytes32 priceId,

        ) = parsePriceFeedMessageFromMemory(data, 0);

        updateLatestPriceIfNecessary(priceId, info);
    }

    function parseAndVerifyBatchMessageVM(
        bytes calldata encodedVm
    ) internal view returns (IWormhole.VM memory vm) {
        {
            bool valid;
            (vm, valid, ) = wormhole().parseAndVerifyVM(encodedVm);
            if (!valid) revert PythErrors.InvalidWormholeVaa();
        }

        if (!verifyPythVM(vm)) revert PythErrors.InvalidUpdateDataSource();
    }

    function verifyPythVM(
        IWormhole.VM memory vm
    ) private view returns (bool valid) {
        return isValidDataSource(vm.emitterChainId, vm.emitterAddress);
    }

    // Update a single price feed via a threshold-signed merkle proof.
    // data is expected to be a serialized PriceFeedMessage
    function updatePriceFeedsThresholdMerkle(
        bytes memory rootSignature,
        bytes32 rootHash,
        bytes memory data,
        bytes32[] memory proof
    ) public payable {
        if (!verifySignature(rootHash, rootSignature, thresholdPublicKey))
            revert PythErrors.InvalidArgument();

        bool validProof = isValidMerkleProof(rootHash, data, proof);
        if (!validProof) revert PythErrors.InvalidArgument();

        (
            PythInternalStructs.PriceInfo memory info,
            bytes32 priceId,

        ) = parsePriceFeedMessageFromMemory(data, 0);
        updateLatestPriceIfNecessary(priceId, info);
    }

    // Update a single price feed via a threshold-signed price update.
    // data is expected to be a serialized PriceFeedMessage.
    function updatePriceFeedsThreshold(
        bytes memory signature,
        bytes memory data
    ) public payable {
        bytes32 hash = keccak256(data);
        if (!verifySignature(hash, signature, thresholdPublicKey))
            revert PythErrors.InvalidArgument();

        (
            PythInternalStructs.PriceInfo memory info,
            bytes32 priceId,

        ) = parsePriceFeedMessageFromMemory(data, 0);
        updateLatestPriceIfNecessary(priceId, info);
    }

    // Update a single price feed via a "native" price update (i.e., using the default ethereum tx signature for authentication).
    // data is expected to be a serialized PriceFeedMessage.
    // This function represents the lower bound on how much gas we can use.
    function updatePriceFeedsNative(bytes memory data) public payable {
        // TODO: this function should have a check on the sender.
        // I'm assuming that check is not very expensive here.

        (
            PythInternalStructs.PriceInfo memory info,
            bytes32 priceId,

        ) = parsePriceFeedMessageFromMemory(data, 0);
        updateLatestPriceIfNecessary(priceId, info);
    }

    function parsePriceFeedMessageFromMemory(
        bytes memory encodedPriceFeed,
        uint offset
    )
        internal
        pure
        returns (
            PythInternalStructs.PriceInfo memory priceInfo,
            bytes32 priceId,
            uint64 prevPublishTime
        )
    {
        unchecked {
            priceId = UnsafeBytesLib.toBytes32(encodedPriceFeed, offset);
            offset += 32;

            priceInfo.price = int64(
                UnsafeBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.conf = UnsafeBytesLib.toUint64(encodedPriceFeed, offset);
            offset += 8;

            priceInfo.expo = int32(
                UnsafeBytesLib.toUint32(encodedPriceFeed, offset)
            );
            offset += 4;

            // Publish time is i64 in some environments due to the standard in that
            // environment. This would not cause any problem because since the signed
            // integer is represented in two's complement, the value would be the same
            // in both cases (for a million year at least)
            priceInfo.publishTime = UnsafeBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            // We do not store this field because it is not used on the latest feed queries.
            prevPublishTime = UnsafeBytesLib.toUint64(encodedPriceFeed, offset);
            offset += 8;

            priceInfo.emaPrice = int64(
                UnsafeBytesLib.toUint64(encodedPriceFeed, offset)
            );
            offset += 8;

            priceInfo.emaConf = UnsafeBytesLib.toUint64(
                encodedPriceFeed,
                offset
            );
            offset += 8;

            if (offset > encodedPriceFeed.length)
                revert PythErrors.InvalidUpdateData();
        }
    }

    // Verify that signature is a valid ECDSA signature of messageHash by signer.
    function verifySignature(
        bytes32 messageHash,
        bytes memory signature,
        address signer
    ) public pure returns (bool) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return false;
        }
        address recoveredAddress = ecrecover(messageHash, v, r, s);
        return (recoveredAddress == signer);
    }

    // Check that proof is a valid merkle proof of data. This function assumes that
    // data is the leftmost node of the tree.
    // TODO: need to encode left/right structure for proof nodes
    function isValidMerkleProof(
        bytes32 expectedRoot,
        bytes memory data,
        bytes32[] memory proof
    ) public pure returns (bool) {
        bytes32 curNodeHash = keccak256(data);
        for (uint i = 0; i < proof.length; ) {
            curNodeHash = keccak256(abi.encode(curNodeHash, proof[i]));
            unchecked {
                i++;
            }
        }

        return (expectedRoot == curNodeHash);
    }
}

// A merkle tree price update delivered via wormhole.
// The update is valid if the data above hashed with the proof nodes sequentially
// equals the root hash in the wormhole VAA.
struct WormholeMerkleUpdate {
    // The serialized bytes of a wormhole VAA
    // The payload of this VAA is a single 32-byte root hash for the merkle tree.
    bytes rootVaa;
    // The serialized bytes of a PriceFeedMessage
    bytes data;
    // The chain of proof nodes.
    bytes32[] proof;
}

// A merkle tree price update delivered via threshold signature.
// The update is valid if the data above hashed with the proof nodes sequentially
// equals the root hash, and the signature is valid for rootHash.
struct ThresholdMerkleUpdate {
    bytes rootSignature;
    bytes32 rootHash;
    // The serialized bytes of a PriceFeedMessage
    bytes data;
    // The chain of proof nodes.
    bytes32[] proof;
}

// A merkle tree price update delivered via threshold signature.
// The update is valid if the data above hashed with the proof nodes sequentially
// equals the root hash, and the signature is valid for rootHash.
struct ThresholdUpdate {
    // Signature of the hash of the data.
    bytes signature;
    // The serialized bytes of a PriceFeedMessage
    bytes data;
}
