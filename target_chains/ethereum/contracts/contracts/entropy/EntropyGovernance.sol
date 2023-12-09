// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.0;

import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

import "./EntropyState.sol";

/**
 * @dev `Governance` defines a means to enacting changes to the Entropy contract.
 */
abstract contract EntropyGovernance is EntropyState {
    event AdminSet(address oldAdmin, address newAdmin);
    event PythFeeSet(uint oldPythFee, uint newPythFee);
    event DefaultProviderSet(
        address oldDefaultProvider,
        address newDefaultProvider
    );

    function getNextOwner() external view returns (address) {
        return _state.nextOwner;
    }

    function getAdmin() external view returns (address) {
        return _state.admin;
    }

    /**
     * @dev Set the admin of the contract.
     *
     * Calls {_authoriseAdminAction}.
     *
     * Emits an {AdminSet} event.
     */
    function setAdmin(address newAdmin) external {
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
