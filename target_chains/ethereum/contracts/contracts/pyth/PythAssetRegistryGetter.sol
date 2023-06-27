// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./PythAssetRegistry.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "../aave/interfaces/IPriceOracleGetter.sol";

abstract contract PythAssetRegistryGetter is
    PythAssetRegistry,
    IPriceOracleGetter
{
    function pyth() public view returns (IPyth) {
        return IPyth(_registryState.pyth);
    }
}
