// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract PythLazer is OwnableUpgradeable, UUPSUpgradeable {
    TrustedSignerInfo[100] internal trustedSigners;
    uint256 public verification_fee;
    mapping(address => uint256) trustedSignerToExpiresAtMapping;

    constructor() {
        _disableInitializers();
    }

    struct TrustedSignerInfo {
        address pubkey;
        uint256 expiresAt;
    }

    /// @notice Emitted when the owner changes the verification fee.
    event VerificationFeeSet(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when `verifyUpdate` could not refund the excess to the
    /// caller. The amount stays in the contract.
    event RefundFailed(address indexed payee, uint256 amount);

    /// @notice Emitted when the owner withdraws the contract balance.
    event FeesWithdrawn(address recipient, uint256 amount);

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

    /// @notice Sends the whole contract balance to `recipient`. Owner only.
    function withdrawFees(address payable recipient) external onlyOwner {
        uint256 amount = address(this).balance;
        emit FeesWithdrawn(recipient, amount);
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Withdraw failed");
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

        // `send` has the same 2300-gas stipend as the old `transfer`, but a
        // caller that cannot take the refund is still verified and the excess
        // stays in the contract.
        uint256 excess = msg.value - fee;
        if (excess > 0 && !payable(msg.sender).send(excess)) {
            emit RefundFailed(msg.sender, excess);
        }
    }

    function version() public pure returns (string memory) {
        return "0.3.0";
    }
}
