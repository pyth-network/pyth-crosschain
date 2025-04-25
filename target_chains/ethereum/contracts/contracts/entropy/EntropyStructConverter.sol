// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyStructs.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyStructsV2.sol";

// Conversions from V2 structs to their V1 equivalents
library EntropyStructConverter {
    function toV1Request(
        EntropyStructsV2.Request memory v2Request
    ) internal pure returns (EntropyStructs.Request memory v1Request) {
        v1Request = EntropyStructs.Request({
            provider: v2Request.provider,
            sequenceNumber: v2Request.sequenceNumber,
            numHashes: v2Request.numHashes,
            commitment: v2Request.commitment,
            blockNumber: v2Request.blockNumber,
            requester: v2Request.requester,
            useBlockhash: v2Request.useBlockhash,
            isRequestWithCallback: v2Request.callbackStatus > 0
        });
    }

    function toV1ProviderInfo(
        EntropyStructsV2.ProviderInfo memory v2ProviderInfo
    )
        internal
        pure
        returns (EntropyStructs.ProviderInfo memory v1ProviderInfo)
    {
        v1ProviderInfo = EntropyStructs.ProviderInfo({
            feeInWei: v2ProviderInfo.feeInWei,
            accruedFeesInWei: v2ProviderInfo.accruedFeesInWei,
            originalCommitment: v2ProviderInfo.originalCommitment,
            originalCommitmentSequenceNumber: v2ProviderInfo
                .originalCommitmentSequenceNumber,
            commitmentMetadata: v2ProviderInfo.commitmentMetadata,
            uri: v2ProviderInfo.uri,
            endSequenceNumber: v2ProviderInfo.endSequenceNumber,
            sequenceNumber: v2ProviderInfo.sequenceNumber,
            currentCommitment: v2ProviderInfo.currentCommitment,
            currentCommitmentSequenceNumber: v2ProviderInfo
                .currentCommitmentSequenceNumber,
            feeManager: v2ProviderInfo.feeManager,
            maxNumHashes: v2ProviderInfo.maxNumHashes
        });
    }
}
