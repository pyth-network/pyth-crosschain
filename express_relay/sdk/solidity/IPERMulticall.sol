// SPDX-License-Identifier: UNLICENSED
// Copyright (C) 2024 Lavra Holdings Limited - All Rights Reserved
pragma solidity ^0.8.0;

interface IPERMulticall {
    // Check if the combination of protocol and permissionKey is allowed within this transaction.
    // This will return true if and only if it's being called while executing the auction winner call.
    // @param protocol The address of the protocol that is gating an action behind this permission
    // @param permissionKey The permission key that is being checked
    // @return permissioned True if the permission is allowed, false otherwise
    function isPermissioned(
        address protocol,
        bytes calldata permissionKey
    ) external view returns (bool permissioned);
}
