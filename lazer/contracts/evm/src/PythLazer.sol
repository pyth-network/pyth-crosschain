// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {console} from "forge-std/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PythLazer is OwnableUpgradeable, UUPSUpgradeable {
    TrustedSignerInfo[2] public trustedSigners;

    struct TrustedSignerInfo {
        address pubkey;
        uint256 expiresAt;
    }

    function initialize(address _topAuthority) public initializer {
        __Ownable_init(_topAuthority);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function updateTrustedSigner(
        address trustedSigner,
        uint256 expiresAt
    ) external onlyOwner {
        if (expiresAt == 0) {
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == trustedSigner) {
                    trustedSigners[i].pubkey = address(0);
                    trustedSigners[i].expiresAt = 0;
                    return;
                }
            }
            revert("no such pubkey");
        } else {
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == trustedSigner) {
                    trustedSigners[i].expiresAt = expiresAt;
                    return;
                }
            }
            // Signer not found - adding a new signer.
            for (uint8 i = 0; i < trustedSigners.length; i++) {
                if (trustedSigners[i].pubkey == address(0)) {
                    trustedSigners[i].pubkey = trustedSigner;
                    trustedSigners[i].expiresAt = expiresAt;
                    return;
                }
            }
            revert("no space for new signer");
        }
    }

    function isValidSigner(address signer) public view returns (bool) {
        for (uint8 i = 0; i < trustedSigners.length; i++) {
            if (trustedSigners[i].pubkey == signer) {
                return block.timestamp < trustedSigners[i].expiresAt;
            }
        }
        return false;
    }

    function verifyUpdate(
        bytes calldata update
    ) external view returns (bytes calldata payload, address signer) {
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
        signer = ecrecover(
            hash,
            uint8(update[68]) + 27,
            bytes32(update[4:36]),
            bytes32(update[36:68])
        );
        if (signer == address(0)) {
            revert("invalid signature");
        }
        console.log("recover address %s", signer);
        if (!isValidSigner(signer)) {
            revert("invalid signer");
        }
    }
}
