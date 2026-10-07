// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract PythLazer is OwnableUpgradeable, UUPSUpgradeable {
    TrustedSignerInfo[100] internal trustedSigners;
    uint256 public verification_fee;
    mapping(address => uint256) trustedSignerToExpiresAtMapping;
    /// @notice Excess value that `verifyUpdate` could not refund, per caller.
    /// Withdraw it with `withdrawRefund`.
    /// @dev Append new state variables after this one. The contract sits behind
    /// upgradeable proxies, so the existing slots must keep their order.
    mapping(address => uint256) public refundable;

    constructor() {
        _disableInitializers();
    }

    struct TrustedSignerInfo {
        address pubkey;
        uint256 expiresAt;
    }

    /// @notice Emitted when the owner changes the verification fee.
    event VerificationFeeSet(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when `verifyUpdate` could not send a refund to the
    /// caller. The amount is credited to `refundable[payee]` instead.
    event RefundFailed(address indexed payee, uint256 amount);

    /// @notice Emitted when a credited refund is withdrawn.
    event RefundWithdrawn(
        address indexed payee,
        address recipient,
        uint256 amount
    );

    /// @dev Upper bound on the gas forwarded to a refund receiver. A plain
    /// payable receive function needs a fraction of this.
    uint256 private constant REFUND_GAS_LIMIT = 30000;

    /// @dev Gas held back from the refund call to pay for the failure path: a
    /// cold `SSTORE` into `refundable` (22100), the `RefundFailed` log, and
    /// the return from `verifyUpdate`.
    uint256 private constant REFUND_FAILURE_GAS = 50000;

    function initialize(address _topAuthority) public initializer {
        __Ownable_init(_topAuthority);
        __UUPSUpgradeable_init();

        verification_fee = 1 wei;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Sets the fee that `verifyUpdate` requires. Owner only.
    /// @param fee The new fee in wei. A fee of 0 makes `verifyUpdate` free.
    function setVerificationFee(uint256 fee) external onlyOwner {
        uint256 oldFee = verification_fee;
        verification_fee = fee;
        emit VerificationFeeSet(oldFee, fee);
    }

    function updateTrustedSigner(
        address trustedSigner,
        uint256 expiresAt
    ) external onlyOwner {
        if (expiresAt == 0) {
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == trustedSigner) {
                    trustedSigners[i].pubkey = address(0);
                    trustedSigners[i].expiresAt = 0;
                    delete trustedSignerToExpiresAtMapping[trustedSigner];
                    return;
                }
            }
            revert("no such pubkey");
        } else {
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == trustedSigner) {
                    trustedSigners[i].expiresAt = expiresAt;
                    trustedSignerToExpiresAtMapping[trustedSigner] = expiresAt;
                    return;
                }
            }
            // Signer not found - adding a new signer.
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == address(0)) {
                    trustedSigners[i].pubkey = trustedSigner;
                    trustedSigners[i].expiresAt = expiresAt;
                    trustedSignerToExpiresAtMapping[trustedSigner] = expiresAt;
                    return;
                }
            }
            revert("no space for new signer");
        }
    }

    function isValidSigner(address signer) public view returns (bool) {
        return block.timestamp < trustedSignerToExpiresAtMapping[signer];
    }

    /// @notice Returns all trusted signers with a non-zero pubkey, in slot order.
    /// @dev Empty slots (pubkey == address(0)) are skipped, so the returned
    /// array length is the number of populated signers (≤ 100).
    function getTrustedSigners()
        external
        view
        returns (TrustedSignerInfo[] memory)
    {
        uint256 count = 0;
        for (uint8 i = 0; i < trustedSigners.length; i++) {
            if (trustedSigners[i].pubkey != address(0)) {
                count++;
            }
        }

        TrustedSignerInfo[] memory signers = new TrustedSignerInfo[](count);
        uint256 j = 0;
        for (uint8 i = 0; i < trustedSigners.length; i++) {
            if (trustedSigners[i].pubkey != address(0)) {
                signers[j] = trustedSigners[i];
                j++;
            }
        }
        return signers;
    }

    /// @notice Returns the stored expiry timestamp for a signer, or 0 if unknown.
    function getTrustedSignerExpiry(
        address signer
    ) external view returns (uint256) {
        return trustedSignerToExpiresAtMapping[signer];
    }

    function verifyUpdate(
        bytes calldata update
    ) external payable returns (bytes calldata payload, address signer) {
        uint256 fee = verification_fee;
        require(msg.value >= fee, "Insufficient fee provided");

        if (update.length < 71) {
            revert("input too short");
        }
        uint32 EVM_FORMAT_MAGIC = 706910618;

        uint32 evm_magic = uint32(bytes4(update[0:4]));
        if (evm_magic != EVM_FORMAT_MAGIC) {
            revert("invalid evm magic");
        }
        uint16 payload_len = uint16(bytes2(update[69:71]));
        if (update.length < 71 + payload_len) {
            revert("input too short");
        }
        payload = update[71:71 + payload_len];
        bytes32 hash = keccak256(payload);
        (signer, , ) = ECDSA.tryRecover(
            hash,
            uint8(update[68]) + 27,
            bytes32(update[4:36]),
            bytes32(update[36:68])
        );
        if (signer == address(0)) {
            revert("invalid signature");
        }
        if (!isValidSigner(signer)) {
            revert("invalid signer");
        }

        _refundExcess(fee);
    }

    /// @dev Returns `msg.value - fee` to the caller. A failed refund does not
    /// revert: a caller contract with no payable receive function would
    /// otherwise lose the ability to verify as soon as the fee drops below the
    /// value it sends. The amount is credited to `refundable` instead, and the
    /// caller withdraws it with `withdrawRefund`.
    ///
    /// The call runs after verification and carries more than the 2300-gas
    /// stipend, so a caller with a payable receive function that does work
    /// still gets the refund. Re-entering is harmless: `verifyUpdate` holds no
    /// state that a nested call can observe or corrupt, and it never pays out
    /// more than the value its own caller attached.
    function _refundExcess(uint256 fee) internal {
        uint256 excess = msg.value - fee;
        if (excess == 0) {
            return;
        }
        (bool sent, ) = msg.sender.call{value: excess, gas: _refundGas()}("");
        if (!sent) {
            refundable[msg.sender] += excess;
            emit RefundFailed(msg.sender, excess);
        }
    }

    /// @dev Gas to forward to the refund call: `REFUND_GAS_LIMIT`, reduced so
    /// that `REFUND_FAILURE_GAS` always stays behind. Without a cap the call
    /// takes all but a sixty-fourth of the remaining gas, and a receiver that
    /// burns its whole allocation leaves too little to credit `refundable` --
    /// the `SSTORE` then trips the 2300-gas sentry and reverts the
    /// verification that already succeeded.
    ///
    /// A return of 0 still delivers the EVM's 2300-gas stipend, because the
    /// call carries value.
    function _refundGas() private view returns (uint256) {
        uint256 available = gasleft();
        if (available <= REFUND_FAILURE_GAS) {
            return 0;
        }
        uint256 forward = available - REFUND_FAILURE_GAS;
        return forward < REFUND_GAS_LIMIT ? forward : REFUND_GAS_LIMIT;
    }

    /// @notice Sends the caller's credited refunds to `recipient`.
    /// @param recipient The address that receives the refund. A caller that
    /// cannot accept ETH itself can name an address that can.
    function withdrawRefund(address payable recipient) external {
        require(recipient != address(0), "Invalid recipient");
        uint256 amount = refundable[msg.sender];
        require(amount > 0, "No refund available");
        refundable[msg.sender] = 0;
        emit RefundWithdrawn(msg.sender, recipient, amount);
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Refund transfer failed");
    }

    function version() public pure returns (string memory) {
        return "0.3.0";
    }
}
