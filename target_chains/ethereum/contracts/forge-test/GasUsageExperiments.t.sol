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

        pyth.initialize(wormhole, emitterChainIds, emitterAddresses);

        // TBD not clear what's going on below here

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

        // updateFee = pyth.getUpdateFee(updateData);
        updateFee = 0;
    }

    function generateMerkleProof(
        bytes32 priceId,
        PythStructs.Price memory price,
        uint depth
    )
        internal
        returns (bytes32 root, bytes memory data, bytes32[] memory proof)
    {
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = priceId;
        PythStructs.Price[] memory prices = new PythStructs.Price[](1);
        prices[0] = price;
        PriceAttestation[] memory attestation = pricesToPriceAttestations(
            priceIds,
            prices
        );
        data = generatePriceFeedUpdatePayload(attestation);

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

        return (curNodeHash, data, proof);
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
        (
            bytes32 root,
            bytes memory data,
            bytes32[] memory proof
        ) = generateMerkleProof(priceIds[0], freshPrices[0], 0);
        assert(pyth.verifyMerkleProof(root, data, proof));
    }

    function testVerifyMerkleProofDepth1() public {
        (
            bytes32 root,
            bytes memory data,
            bytes32[] memory proof
        ) = generateMerkleProof(priceIds[0], freshPrices[0], 1);
        assert(pyth.verifyMerkleProof(root, data, proof));
    }

    function testVerifyMerkleProofDepth8() public {
        (
            bytes32 root,
            bytes memory data,
            bytes32[] memory proof
        ) = generateMerkleProof(priceIds[0], freshPrices[0], 8);
        assert(pyth.verifyMerkleProof(root, data, proof));
    }

    /*
    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeed() public {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForTwoPriceFeed() public {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = priceIds[0];
        ids[1] = priceIds[1];

        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
            ids,
            0,
            50
        );
    }

    function testBenchmarkParsePriceFeedUpdatesForOnePriceFeedNotWithinRange()
        public
    {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = priceIds[0];

        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pyth.parsePriceFeedUpdates{value: freshPricesUpdateFee}(
            freshPricesUpdateData,
            ids,
            50,
            100
        );
    }

    function testBenchmarkGetPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // is set to 60 seconds, the getPrice should work as expected.
        vm.warp(0);

        pyth.getPrice(priceIds[0]);
    }

    function testBenchmarkGetEmaPrice() public {
        // Set the block timestamp to 0. As prices have < 10 timestamp and staleness
        // is set to 60 seconds, the getPrice should work as expected.
        vm.warp(0);

        pyth.getEmaPrice(priceIds[0]);
    }

    function testBenchmarkGetUpdateFee() public view {
        pyth.getUpdateFee(freshPricesUpdateData);
    }
    */
}

contract PythExperimental {
    address payable wormholeAddr;
    // For tracking all active emitter/chain ID pairs
    PythInternalStructs.DataSource[] validDataSources;
    mapping(bytes32 => bool) isValidDataSource;

    function initialize(
        address payable wormholeArg,
        uint16[] calldata dataSourceEmitterChainIds,
        bytes32[] calldata dataSourceEmitterAddresses
    ) public {
        wormholeAddr = wormholeArg;

        if (
            dataSourceEmitterChainIds.length !=
            dataSourceEmitterAddresses.length
        ) revert PythErrors.InvalidArgument();

        for (uint i = 0; i < dataSourceEmitterChainIds.length; i++) {
            PythInternalStructs.DataSource memory ds = PythInternalStructs
                .DataSource(
                    dataSourceEmitterChainIds[i],
                    dataSourceEmitterAddresses[i]
                );

            isValidDataSource[hashDataSource(ds)] = true;
            validDataSources.push(ds);
        }
    }

    // Experiment 1: Minimal wormhole update. No hashing or anything is performed.

    function updatePriceFeeds(bytes[] calldata updateData) public payable {
        for (uint i = 0; i < updateData.length; ) {
            IWormhole.VM memory vm = parseAndVerifyBatchAttestationVM(
                updateData[i]
            );

            unchecked {
                i++;
            }
        }
    }

    function parseAndVerifyBatchAttestationVM(
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
        return
            isValidDataSource[
                keccak256(
                    abi.encodePacked(vm.emitterChainId, vm.emitterAddress)
                )
            ];
    }

    // Experiment 2: Minimal merkle tree verification.@author

    // TODO: need to encode left/right structure for proof nodes
    function verifyMerkleProof(
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

    // Misc utilities

    function hashDataSource(
        PythInternalStructs.DataSource memory ds
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(ds.chainId, ds.emitterAddress));
    }

    function wormhole() public view returns (IWormhole) {
        return IWormhole(wormholeAddr);
    }
}
