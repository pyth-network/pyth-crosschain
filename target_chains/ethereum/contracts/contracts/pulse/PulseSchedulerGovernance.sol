// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "./SchedulerState.sol";

/**
 * @dev `PulseSchedulerGovernance` defines governance capabilities for the Pulse Scheduler contract.
 * Initially, it only supports admin proposal/acceptance and contract upgrade functionality.
 */
abstract contract PulseSchedulerGovernance is SchedulerState {
    event NewAdminProposed(address oldAdmin, address newAdmin);
    event NewAdminAccepted(address oldAdmin, address newAdmin);

    /**
     * @dev Returns the address of the proposed admin.
     */
    function proposedAdmin() public view virtual returns (address) {
        return _proposedAdmin;
    }

    /**
     * @dev Returns the address of the current admin.
     */
    function getAdmin() external view returns (address) {
        return _state.admin;
    }

    /**
     * @dev Proposes a new admin for the contract. Replaces the proposed admin if there is one.
     * Can only be called by either admin or owner.
     */
    function proposeAdmin(address newAdmin) public virtual {
        require(newAdmin != address(0), "newAdmin is zero address");

        _authorizeAdminAction();

        _proposedAdmin = newAdmin;
        emit NewAdminProposed(_state.admin, newAdmin);
    }

    /**
     * @dev The proposed admin accepts the admin transfer.
     */
    function acceptAdmin() external {
        if (msg.sender != _proposedAdmin)
            revert("Unauthorized");

        address oldAdmin = _state.admin;
        _state.admin = msg.sender;

        _proposedAdmin = address(0);
        emit NewAdminAccepted(oldAdmin, msg.sender);
    }

    /**
     * @dev Authorization check for admin actions
     * Must be implemented by the inheriting contract.
     */
    function _authorizeAdminAction() internal virtual;
}
