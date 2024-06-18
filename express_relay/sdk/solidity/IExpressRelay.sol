// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

interface IExpressRelay {
    // Check if the combination of protocol and permissionKey is allowed within this transaction.
    // This will return true if and only if it's being called while executing the auction winner(s) call.
    // @param protocolFeeReceiver The address of the protocol that is gating an action behind this permission
    // @param permissionId The id that represents the action being gated
    // @return permissioned True if the permission is allowed, false otherwise
    function isPermissioned(
        address protocolFeeReceiver,
        bytes calldata permissionId
    ) external view returns (bool permissioned);
}
