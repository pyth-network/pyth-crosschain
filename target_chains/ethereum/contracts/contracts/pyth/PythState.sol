// contracts/State.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythInternalStructs.sol";
import "./PythDeprecatedStructs.sol";

contract PythStorage {
    struct State {
        address wormhole;
        uint16 _deprecatedPyth2WormholeChainId; // Replaced by validDataSources/isValidDataSource
        bytes32 _deprecatedPyth2WormholeEmitter; // Ditto
        // After a backward-incompatible change in PriceFeed this mapping got deprecated.
        mapping(bytes32 => PythDeprecatedStructs.DeprecatedPriceInfoV1) _deprecatedLatestPriceInfoV1;
        // For tracking all active emitter/chain ID pairs
        PythInternalStructs.DataSource[] validDataSources;
        // (chainId, emitterAddress) => isValid; takes advantage of
        // constant-time mapping lookup for VM verification
        mapping(bytes32 => bool) isValidDataSource;
        uint singleUpdateFeeInWei;
        /// Maximum acceptable time period before price is considered to be stale.
        /// This includes attestation delay, block time, and potential clock drift
        /// between the source/target chains.
        uint validTimePeriodSeconds;
        // Governance data source. VAA messages from this source can change this contract
        // state. e.g., upgrade the contract, change the valid data sources, and more.
        PythInternalStructs.DataSource governanceDataSource;
        // Sequence number of the last executed governance message. Any governance message
        // with a lower or equal sequence number will be discarded. This prevents double-execution,
        // and also makes sure that messages are executed in the right order.
        uint64 lastExecutedGovernanceSequence;
        // After a backward-incompatible change in PriceFeed this mapping got deprecated.
        mapping(bytes32 => PythDeprecatedStructs.DeprecatedPriceInfoV2) _deprecatedLatestPriceInfoV2;
        // Index of the governance data source, increased each time the governance data source
        // changes.
        uint32 governanceDataSourceIndex;
        // Mapping of cached price information
        // priceId => PriceInfo
        mapping(bytes32 => PythInternalStructs.PriceInfo) latestPriceInfo;
        // Fee charged per transaction, in addition to per-update fees
        uint transactionFeeInWei;
    }
}

contract PythState {
    PythStorage.State _state;
}
