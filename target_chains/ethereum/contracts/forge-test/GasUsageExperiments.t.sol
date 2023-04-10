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

contract GasUsageExperiments is Test, WormholeTestUtils, PythTestUtils {
    // 19, current mainnet number of guardians, is used to have gas estimates
    // close to our mainnet transactions.
    uint8 constant NUM_GUARDIANS = 19;
    // 2/3 of the guardians should sign a message for a VAA which is 13 out of 19 guardians.
    // It is possible to have more signers but the median seems to be 13.
    uint8 constant NUM_GUARDIAN_SIGNERS = 13;

    // We use 5 prices to form a batch of 5 prices, close to our mainnet transactions.
    uint8 constant NUM_PRICES = 5;

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

    WormholeMerkleUpdate merkleUpdateDepth0;
    WormholeMerkleUpdate merkleUpdateDepth1;
    WormholeMerkleUpdate merkleUpdateDepth8;

    uint64 sequence;
    uint randSeed;

    function setUp() public {
        address payable wormhole = payable(setUpWormhole(NUM_GUARDIANS));

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

        for (uint i = 0; i < NUM_PRICES; ++i) {
            uint64 publishTime = uint64(getRand() % 10);

            cachedPrices.push(
                PythStructs.Price(
                    int64(uint64(getRand() % 1000)), // Price
                    uint64(getRand() % 100), // Confidence
                    -5, // Expo
                    publishTime
                )
            );
            cachedPricesPublishTimes.push(publishTime);

            publishTime += uint64(getRand() % 10);
            freshPrices.push(
                PythStructs.Price(
                    int64(uint64(getRand() % 1000)), // Price
                    uint64(getRand() % 100), // Confidence
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
        ) = generateUpdateDataAndFee(cachedPrices);
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData
        );

        (
            freshPricesUpdateData,
            freshPricesUpdateFee
        ) = generateUpdateDataAndFee(freshPrices);

        merkleUpdateDepth0 = generateMerkleProof(
            priceIds[0],
            freshPrices[0],
            0
        );
        merkleUpdateDepth1 = generateMerkleProof(
            priceIds[0],
            freshPrices[0],
            1
        );
        merkleUpdateDepth8 = generateMerkleProof(
            priceIds[0],
            freshPrices[0],
            8
        );
    }

    function getRand() internal returns (uint val) {
        ++randSeed;
        val = uint(keccak256(abi.encode(randSeed)));
    }

    function generateUpdateDataAndFee(
        PythStructs.Price[] memory prices
    ) internal returns (bytes[] memory updateData, uint updateFee) {
        bytes memory vaa = generatePriceFeedUpdateVAA(
            pricesToPriceAttestations(priceIds, prices),
            sequence,
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;

        updateData = new bytes[](1);
        updateData[0] = vaa;

        updateFee = pyth.getUpdateFee(updateData);
    }

    function generateMerkleProof(
        bytes32 priceId,
        PythStructs.Price memory price,
        uint depth
    ) internal returns (WormholeMerkleUpdate memory update) {
        bytes32[] memory attestationPriceIds = new bytes32[](1);
        attestationPriceIds[0] = priceId;
        PythStructs.Price[] memory prices = new PythStructs.Price[](1);
        prices[0] = price;
        PriceAttestation[] memory attestation = pricesToPriceAttestations(
            attestationPriceIds,
            prices
        );
        bytes memory data = generatePriceFeedUpdatePayload(attestation);

        bytes32 curNodeHash = keccak256(data);
        bytes32[] memory proof = new bytes32[](depth);
        for (uint i = 0; i < depth; ) {
            // pretend the ith sibling is just i
            proof[i] = keccak256(abi.encode(i));
            curNodeHash = keccak256(abi.encode(curNodeHash, proof[i]));

            unchecked {
                i++;
            }
        }

        bytes memory rootVaa = generateVaa(
            uint32(block.timestamp),
            PythTestUtils.SOURCE_EMITTER_CHAIN_ID,
            PythTestUtils.SOURCE_EMITTER_ADDRESS,
            sequence,
            bytes.concat(curNodeHash), // the root hash
            NUM_GUARDIAN_SIGNERS
        );

        ++sequence;

        return WormholeMerkleUpdate(rootVaa, data, proof);
    }

    function testBenchmarkUpdatePriceFeedsFresh() public {
        pyth.updatePriceFeeds{value: freshPricesUpdateFee}(
            freshPricesUpdateData
        );
    }

    function testBenchmarkUpdatePriceFeedsNotFresh() public {
        pyth.updatePriceFeeds{value: cachedPricesUpdateFee}(
            cachedPricesUpdateData
        );
    }

    function testVerifyMerkleProofDepth0() public {
        pyth.updatePriceFeedsMerkle(
            merkleUpdateDepth0.rootVaa,
            merkleUpdateDepth0.data,
            merkleUpdateDepth0.proof
        );
    }

    function testVerifyMerkleProofDepth1() public {
        pyth.updatePriceFeedsMerkle(
            merkleUpdateDepth1.rootVaa,
            merkleUpdateDepth1.data,
            merkleUpdateDepth1.proof
        );
    }

    function testVerifyMerkleProofDepth8() public {
        pyth.updatePriceFeedsMerkle(
            merkleUpdateDepth8.rootVaa,
            merkleUpdateDepth8.data,
            merkleUpdateDepth8.proof
        );
    }
}

// Pyth contract extended with methods for other verification systems (merkle proofs / threshold signatures)
contract PythExperimental is Pyth {
    function initialize(
        address wormhole,
        uint16[] calldata dataSourceEmitterChainIds,
        bytes32[] calldata dataSourceEmitterAddresses,
        uint16 governanceEmitterChainId,
        bytes32 governanceEmitterAddress,
        uint64 governanceInitialSequence,
        uint validTimePeriodSeconds,
        uint singleUpdateFeeInWei
    ) public {
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

    // Experiment 2: Minimal merkle tree verification.
    function updatePriceFeedsMerkle(
        bytes calldata rootVaa,
        bytes memory data,
        bytes32[] memory proof
    ) public payable {
        IWormhole.VM memory vm = parseAndVerifyBatchAttestationVM(rootVaa);
        assert(vm.payload.length == 32);

        bytes32 expectedRoot = UnsafeBytesLib.toBytes32(vm.payload, 0);
        bool validProof = isValidMerkleProof(expectedRoot, data, proof);
        if (!validProof) revert PythErrors.InvalidArgument();

        (
            PythInternalStructs.PriceInfo memory info,
            bytes32 priceId
        ) = parseSingleAttestationFromBatch(data, 0, data.length);
        uint64 latestPublishTime = latestPriceInfoPublishTime(priceId);

        if (info.publishTime > latestPublishTime) {
            setLatestPriceInfo(priceId, info);
            emit PriceFeedUpdate(
                priceId,
                info.publishTime,
                info.price,
                info.conf
            );
        }
    }

    // TODO: need to encode left/right structure for proof nodes
    function isValidMerkleProof(
        bytes32 expectedRoot,
        bytes memory data,
        bytes32[] memory proof
    ) public returns (bool) {
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
    // The serialized bytes of a PriceAttestation
    bytes data;
    // The chain of proof nodes.
    bytes32[] proof;
}
