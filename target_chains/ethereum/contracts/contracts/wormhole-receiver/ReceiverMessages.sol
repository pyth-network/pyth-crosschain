// contracts/Messages.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./ReceiverGetters.sol";
import "./ReceiverStructs.sol";
import "../libraries/external/BytesLib.sol";
import "../libraries/external/UnsafeCalldataBytesLib.sol";

error VmVersionIncompatible();
error SignatureIndexesNotAscending();

contract ReceiverMessages is ReceiverGetters {
    using BytesLib for bytes;

    /// @dev parseAndVerifyVM serves to parse an encodedVM and wholy validate it for consumption
    /// WARNING: it intentionally sets vm.signatures to an empty array since it is not needed after it is validated in this function
    /// since it not used anywhere. If you need to use vm.signatures, use parseVM and verifyVM separately.
    function parseAndVerifyVM(
        bytes calldata encodedVM
    )
        public
        view
        returns (ReceiverStructs.VM memory vm, bool valid, string memory reason)
    {
        uint index = 0;
        unchecked {
            {
                vm.version = UnsafeCalldataBytesLib.toUint8(encodedVM, index);
                index += 1;
                if (vm.version != 1) {
                    revert VmVersionIncompatible();
                }
            }

            ReceiverStructs.GuardianSet memory guardianSet;
            {
                vm.guardianSetIndex = UnsafeCalldataBytesLib.toUint32(
                    encodedVM,
                    index
                );
                index += 4;
                guardianSet = getGuardianSet(vm.guardianSetIndex);

                /**
                 * @dev Checks whether the guardianSet has zero keys
                 * WARNING: This keys check is critical to ensure the guardianSet has keys present AND to ensure
                 * that guardianSet key size doesn't fall to zero and negatively impact quorum assessment.  If guardianSet
                 * key length is 0 and vm.signatures length is 0, this could compromise the integrity of both vm and
                 * signature verification.
                 */
                if (guardianSet.keys.length == 0) {
                    return (vm, false, "invalid guardian set");
                }

                /// @dev Checks if VM guardian set index matches the current index (unless the current set is expired).
                if (
                    vm.guardianSetIndex != getCurrentGuardianSetIndex() &&
                    guardianSet.expirationTime < block.timestamp
                ) {
                    return (vm, false, "guardian set has expired");
                }
            }

            // Parse Signatures
            uint256 signersLen = UnsafeCalldataBytesLib.toUint8(
                encodedVM,
                index
            );
            index += 1;
            {
                // 66 is the length of each signature
                // 1 (guardianIndex) + 32 (r) + 32 (s) + 1 (v)
                uint hashIndex = index + (signersLen * 66);
                if (hashIndex >= encodedVM.length) {
                    return (vm, false, "invalid signature length");
                }
                // Hash the body
                vm.hash = keccak256(
                    abi.encodePacked(
                        keccak256(
                            UnsafeCalldataBytesLib.sliceFrom(
                                encodedVM,
                                hashIndex
                            )
                        )
                    )
                );
            }

            {
                uint8 lastIndex = 0;
                for (uint i = 0; i < signersLen; i++) {
                    ReceiverStructs.Signature memory sig;
                    sig.guardianIndex = UnsafeCalldataBytesLib.toUint8(
                        encodedVM,
                        index
                    );
                    index += 1;

                    sig.r = UnsafeCalldataBytesLib.toBytes32(encodedVM, index);
                    index += 32;
                    sig.s = UnsafeCalldataBytesLib.toBytes32(encodedVM, index);
                    index += 32;
                    sig.v =
                        UnsafeCalldataBytesLib.toUint8(encodedVM, index) +
                        27;
                    index += 1;
                    bool signatureValid;
                    string memory invalidReason;
                    (signatureValid, invalidReason) = verifySignature(
                        i,
                        lastIndex,
                        vm.hash,
                        sig.guardianIndex,
                        sig.r,
                        sig.s,
                        sig.v,
                        guardianSet.keys[sig.guardianIndex]
                    );
                    if (!signatureValid) {
                        return (vm, false, invalidReason);
                    }
                    lastIndex = sig.guardianIndex;
                }
            }

            /**
             * @dev We're using a fixed point number transformation with 1 decimal to deal with rounding.
             *   WARNING: This quorum check is critical to assessing whether we have enough Guardian signatures to validate a VM
             *   if making any changes to this, obtain additional peer review. If guardianSet key length is 0 and
             *   vm.signatures length is 0, this could compromise the integrity of both vm and signature verification.
             */

            if (
                (((guardianSet.keys.length * 10) / 3) * 2) / 10 + 1 > signersLen
            ) {
                return (vm, false, "no quorum");
            }

            // purposely setting vm.signatures to empty array since we don't need it anymore
            // and we've already verified it above
            vm.signatures = new ReceiverStructs.Signature[](0);

            // Parse the body
            vm.timestamp = UnsafeCalldataBytesLib.toUint32(encodedVM, index);
            index += 4;

            vm.nonce = UnsafeCalldataBytesLib.toUint32(encodedVM, index);
            index += 4;

            vm.emitterChainId = UnsafeCalldataBytesLib.toUint16(
                encodedVM,
                index
            );
            index += 2;

            vm.emitterAddress = UnsafeCalldataBytesLib.toBytes32(
                encodedVM,
                index
            );
            index += 32;

            vm.sequence = UnsafeCalldataBytesLib.toUint64(encodedVM, index);
            index += 8;

            vm.consistencyLevel = UnsafeCalldataBytesLib.toUint8(
                encodedVM,
                index
            );
            index += 1;

            if (index > encodedVM.length) {
                return (vm, false, "invalid payload length");
            }

            vm.payload = UnsafeCalldataBytesLib.sliceFrom(encodedVM, index);

            return (vm, true, "");
        }
    }

    /**
     * @dev `verifyVM` serves to validate an arbitrary vm against a valid Guardian set
     *  - it aims to make sure the VM is for a known guardianSet
     *  - it aims to ensure the guardianSet is not expired
     *  - it aims to ensure the VM has reached quorum
     *  - it aims to verify the signatures provided against the guardianSet
     */
    function verifyVM(
        ReceiverStructs.VM memory vm
    ) public view returns (bool valid, string memory reason) {
        /// @dev Obtain the current guardianSet for the guardianSetIndex provided
        ReceiverStructs.GuardianSet memory guardianSet = getGuardianSet(
            vm.guardianSetIndex
        );

        /**
         * @dev Checks whether the guardianSet has zero keys
         * WARNING: This keys check is critical to ensure the guardianSet has keys present AND to ensure
         * that guardianSet key size doesn't fall to zero and negatively impact quorum assessment.  If guardianSet
         * key length is 0 and vm.signatures length is 0, this could compromise the integrity of both vm and
         * signature verification.
         */
        if (guardianSet.keys.length == 0) {
            return (false, "invalid guardian set");
        }

        /// @dev Checks if VM guardian set index matches the current index (unless the current set is expired).
        if (
            vm.guardianSetIndex != getCurrentGuardianSetIndex() &&
            guardianSet.expirationTime < block.timestamp
        ) {
            return (false, "guardian set has expired");
        }

        /**
         * @dev We're using a fixed point number transformation with 1 decimal to deal with rounding.
         *   WARNING: This quorum check is critical to assessing whether we have enough Guardian signatures to validate a VM
         *   if making any changes to this, obtain additional peer review. If guardianSet key length is 0 and
         *   vm.signatures length is 0, this could compromise the integrity of both vm and signature verification.
         */
        if (
            (((guardianSet.keys.length * 10) / 3) * 2) / 10 + 1 >
            vm.signatures.length
        ) {
            return (false, "no quorum");
        }

        /// @dev Verify the proposed vm.signatures against the guardianSet
        (bool signaturesValid, string memory invalidReason) = verifySignatures(
            vm.hash,
            vm.signatures,
            guardianSet
        );
        if (!signaturesValid) {
            return (false, invalidReason);
        }

        /// If we are here, we've validated the VM is a valid multi-sig that matches the guardianSet.
        return (true, "");
    }

    function verifySignature(
        uint i,
        uint8 lastIndex,
        bytes32 hash,
        uint8 guardianIndex,
        bytes32 r,
        bytes32 s,
        uint8 v,
        address guardianSetKey
    ) private pure returns (bool valid, string memory reason) {
        /// Ensure that provided signature indices are ascending only
        if (i != 0 && guardianIndex <= lastIndex) {
            revert SignatureIndexesNotAscending();
        }
        /// Check to see if the signer of the signature does not match a specific Guardian key at the provided index
        if (ecrecover(hash, v, r, s) != guardianSetKey) {
            return (false, "VM signature invalid");
        }
        return (true, "");
    }

    /**
     * @dev verifySignatures serves to validate arbitrary sigatures against an arbitrary guardianSet
     *  - it intentionally does not solve for expectations within guardianSet (you should use verifyVM if you need these protections)
     *  - it intentioanlly does not solve for quorum (you should use verifyVM if you need these protections)
     *  - it intentionally returns true when signatures is an empty set (you should use verifyVM if you need these protections)
     */
    function verifySignatures(
        bytes32 hash,
        ReceiverStructs.Signature[] memory signatures,
        ReceiverStructs.GuardianSet memory guardianSet
    ) public pure returns (bool valid, string memory reason) {
        uint8 lastIndex = 0;
        for (uint i = 0; i < signatures.length; i++) {
            ReceiverStructs.Signature memory sig = signatures[i];
            (valid, reason) = verifySignature(
                i,
                lastIndex,
                hash,
                sig.guardianIndex,
                sig.r,
                sig.s,
                sig.v,
                guardianSet.keys[sig.guardianIndex]
            );
            if (!valid) {
                return (false, reason);
            }
            lastIndex = sig.guardianIndex;
        }

        /// If we are here, we've validated that the provided signatures are valid for the provided guardianSet
        return (true, "");
    }

    /**
     * @dev parseVM serves to parse an encodedVM into a vm struct
     *  - it intentionally performs no validation functions, it simply parses raw into a struct
     */
    function parseVM(
        bytes memory encodedVM
    ) public pure virtual returns (ReceiverStructs.VM memory vm) {
        uint index = 0;

        vm.version = encodedVM.toUint8(index);
        index += 1;
        if (vm.version != 1) {
            revert VmVersionIncompatible();
        }

        vm.guardianSetIndex = encodedVM.toUint32(index);
        index += 4;

        // Parse Signatures
        uint256 signersLen = encodedVM.toUint8(index);
        index += 1;
        vm.signatures = new ReceiverStructs.Signature[](signersLen);
        for (uint i = 0; i < signersLen; i++) {
            vm.signatures[i].guardianIndex = encodedVM.toUint8(index);
            index += 1;

            vm.signatures[i].r = encodedVM.toBytes32(index);
            index += 32;
            vm.signatures[i].s = encodedVM.toBytes32(index);
            index += 32;
            vm.signatures[i].v = encodedVM.toUint8(index) + 27;
            index += 1;
        }

        // Hash the body
        bytes memory body = encodedVM.slice(index, encodedVM.length - index);
        vm.hash = keccak256(abi.encodePacked(keccak256(body)));

        // Parse the body
        vm.timestamp = encodedVM.toUint32(index);
        index += 4;

        vm.nonce = encodedVM.toUint32(index);
        index += 4;

        vm.emitterChainId = encodedVM.toUint16(index);
        index += 2;

        vm.emitterAddress = encodedVM.toBytes32(index);
        index += 32;

        vm.sequence = encodedVM.toUint64(index);
        index += 8;

        vm.consistencyLevel = encodedVM.toUint8(index);
        index += 1;

        vm.payload = encodedVM.slice(index, encodedVM.length - index);
    }
}
