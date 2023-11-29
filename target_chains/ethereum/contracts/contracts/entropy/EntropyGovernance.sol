// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyState.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Entropy contract.
 */
abstract contract EntropyGovernance is EntropyState {
    event AdminSet(address oldAdmin, address newAdmin);
    event FeeSet(uint oldFee, uint newFee);
    event DefaultProviderSet(
        address oldDefaultProvider,
        address newDefaultProvider
    );

    /**
     * @dev Set the admin of the contract.
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {AdminSet} event.
     */
    function setAdmin(address newAdmin) public {
        _authoriseAdminAction();

        address oldAdmin = _state.admin;
        _state.admin = newAdmin;

        emit AdminSet(oldAdmin, newAdmin);
    }

    /**
     * @dev Set the Pyth fee in Wei
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {FeeSet} event.
     */
    function setFee(uint newFee) public {
        _authoriseAdminAction();

        uint oldFee = _state.pythFeeInWei;
        _state.pythFeeInWei = newFee;

        emit FeeSet(oldFee, newFee);
    }

    /**
     * @dev Set the default provider of the contract
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {DefaultProviderSet} event.
     */
    function setDefaultProvider(address newDefaultProvider) public {
        _authoriseAdminAction();

        address oldDefaultProvider = _state.defaultProvider;
        _state.defaultProvider = newDefaultProvider;

        emit DefaultProviderSet(oldDefaultProvider, newDefaultProvider);
    }

    function _authoriseAdminAction() internal virtual;
}
