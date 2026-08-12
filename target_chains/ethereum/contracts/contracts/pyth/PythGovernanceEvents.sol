// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./PythInternalStructs.sol";

/**
 * @dev The events emitted while executing Pyth governance instructions.
 *
 * They live in a shared interface so that the implementation contract keeps them
 * in its ABI while the `PythGovernanceModule` library — which runs via
 * `delegatecall` and therefore emits from the proxy address — can emit them.
 */
interface IPythGovernanceEvents {
    event ContractUpgraded(address oldImplementation, address newImplementation);
    event GovernanceDataSourceSet(
        PythInternalStructs.DataSource oldDataSource,
        PythInternalStructs.DataSource newDataSource,
        uint64 initialSequence
    );
    event DataSourcesSet(
        PythInternalStructs.DataSource[] oldDataSources,
        PythInternalStructs.DataSource[] newDataSources
    );
    event FeeSet(uint oldFee, uint newFee);
    event ValidPeriodSet(uint oldValidPeriod, uint newValidPeriod);
    event WormholeAddressSet(
        address oldWormholeAddress,
        address newWormholeAddress
    );
    event TransactionFeeSet(uint oldFee, uint newFee);
    event FeeWithdrawn(address targetAddress, uint fee);
}
