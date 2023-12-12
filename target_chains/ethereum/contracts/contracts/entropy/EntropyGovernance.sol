// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyState.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Entropy contract.
 */
abstract contract EntropyGovernance is EntropyState {
    event PythFeeSet(uint oldPythFee, uint newPythFee);
    event DefaultProviderSet(
        address oldDefaultProvider,
        address newDefaultProvider
    );

    event NewAdminProposed(address oldAdmin, address newAdmin);
    event NewAdminAccepted(address oldAdmin, address newAdmin);

    /**
     * @dev Returns the address of the proposed admin.
     */
    function proposedAdmin() public view virtual returns (address) {
        return _state.proposedAdmin;
    }

    /**
     * @dev Proposes a new admin of the contract. Replaces the proposed admin if there is one.
     * Can only be called by either admin or owner.
     */
    function proposeAdmin(address newAdmin) public virtual {
        _authoriseAdminAction();

        _state.proposedAdmin = newAdmin;
        emit NewAdminProposed(_state.admin, newAdmin);
    }

    /**
     * @dev The proposed admin accepts the admin transfer.
     */
    function acceptAdmin() external {
        if (msg.sender != _state.proposedAdmin)
            revert EntropyErrors.Unauthorized();

        address oldAdmin = _state.admin;
        _state.admin = msg.sender;

        _state.proposedAdmin = address(0);
        emit NewAdminAccepted(oldAdmin, msg.sender);
    }

    function getAdmin() external view returns (address) {
        return _state.admin;
    }

    /**
     * @dev Set the Pyth fee in Wei
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {PythFeeSet} event.
     */
    function setPythFee(uint128 newPythFee) external {
        _authoriseAdminAction();

        uint oldPythFee = _state.pythFeeInWei;
        _state.pythFeeInWei = newPythFee;

        emit PythFeeSet(oldPythFee, newPythFee);
    }

    /**
     * @dev Set the default provider of the contract
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {DefaultProviderSet} event.
     */
    function setDefaultProvider(address newDefaultProvider) external {
        _authoriseAdminAction();

        address oldDefaultProvider = _state.defaultProvider;
        _state.defaultProvider = newDefaultProvider;

        emit DefaultProviderSet(oldDefaultProvider, newDefaultProvider);
    }

    function _authoriseAdminAction() internal virtual;
}
