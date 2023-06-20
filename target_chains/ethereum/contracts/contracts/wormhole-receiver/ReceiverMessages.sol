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
    function parseAndVerifyVM(
        bytes calldata encodedVM
    )
        public
        view
        returns (
            bool valid,
            string memory reason,
            uint16 emitterChainId,
            bytes32 emitterAddress,
            uint64 sequence,
            bytes calldata vmPayload
        )
    {
        vmPayload = encodedVM;
        uint index = 0;

        {
            uint8 version = UnsafeCalldataBytesLib.toUint8(encodedVM, index);
            index += 1;
            if (version != 1) {
                revert VmVersionIncompatible();
            }
        }

        ReceiverStructs.GuardianSet memory guardianSet;
        {
            uint32 guardianSetIndex = UnsafeCalldataBytesLib.toUint32(
                encodedVM,
                index
            );
            index += 4;
            guardianSet = getGuardianSet(guardianSetIndex);

            /**
             * @dev Checks whether the guardianSet has zero keys
             * WARNING: This keys check is critical to ensure the guardianSet has keys present AND to ensure
             * that guardianSet key size doesn't fall to zero and negatively impact quorum assessment.  If guardianSet
             * key length is 0 and vm.signatures length is 0, this could compromise the integrity of both vm and
             * signature verification.
             */
            if (guardianSet.keys.length == 0) {
                return (
                    false,
                    "invalid guardian set",
                    emitterChainId,
                    emitterAddress,
                    sequence,
                    vmPayload
                );
            }

            /// @dev Checks if VM guardian set index matches the current index (unless the current set is expired).
            if (
                guardianSetIndex != getCurrentGuardianSetIndex() &&
                guardianSet.expirationTime < block.timestamp
            ) {
                return (
                    false,
                    "guardian set has expired",
                    emitterChainId,
                    emitterAddress,
                    sequence,
                    vmPayload
                );
            }
        }

        // Parse Signatures
        uint256 signersLen = UnsafeCalldataBytesLib.toUint8(encodedVM, index);
        index += 1;
        ReceiverStructs.Signature[] memory signatures;
        {
            signatures = new ReceiverStructs.Signature[](signersLen);
            for (uint i = 0; i < signersLen; i++) {
                signatures[i].guardianIndex = UnsafeCalldataBytesLib.toUint8(
                    encodedVM,
                    index
                );
                index += 1;

                signatures[i].r = UnsafeCalldataBytesLib.toBytes32(
                    encodedVM,
                    index
                );
                index += 32;
                signatures[i].s = UnsafeCalldataBytesLib.toBytes32(
                    encodedVM,
                    index
                );
                index += 32;
                signatures[i].v =
                    UnsafeCalldataBytesLib.toUint8(encodedVM, index) +
                    27;
                index += 1;
            }

            /**
             * @dev We're using a fixed point number transformation with 1 decimal to deal with rounding.
             *   WARNING: This quorum check is critical to assessing whether we have enough Guardian signatures to validate a VM
             *   if making any changes to this, obtain additional peer review. If guardianSet key length is 0 and
             *   vm.signatures length is 0, this could compromise the integrity of both vm and signature verification.
             */

            if (
                (((guardianSet.keys.length * 10) / 3) * 2) / 10 + 1 >
                signatures.length
            ) {
                return (
                    false,
                    "no quorum",
                    emitterChainId,
                    emitterAddress,
                    sequence,
                    vmPayload
                );
            }
        }

        // Hash the body
        bytes32 hash = keccak256(
            abi.encodePacked(
                keccak256(UnsafeCalldataBytesLib.sliceFrom(encodedVM, index))
            )
        );

        {
            /// @dev Verify the proposed vm.signatures against the guardianSet
            (
                bool signaturesValid,
                string memory invalidReason
            ) = verifySignatures(hash, signatures, guardianSet);
            if (!signaturesValid) {
                return (
                    false,
                    invalidReason,
                    emitterChainId,
                    emitterAddress,
                    sequence,
                    vmPayload
                );
            }
        }

        // Parse the body
        // unused uint32 timestamp;
        index += 4;

        // unused uint32 nonce;
        index += 4;

        emitterChainId = UnsafeCalldataBytesLib.toUint16(encodedVM, index);
        index += 2;

        emitterAddress = UnsafeCalldataBytesLib.toBytes32(encodedVM, index);
        index += 32;

        sequence = UnsafeCalldataBytesLib.toUint64(encodedVM, index);
        index += 8;

        // unused uint8 consistencyLevel
        index += 1;

        vmPayload = UnsafeCalldataBytesLib.sliceFrom(encodedVM, index);

        return (true, "", emitterChainId, emitterAddress, sequence, vmPayload);
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

            /// Ensure that provided signature indices are ascending only
            if (i != 0 && sig.guardianIndex <= lastIndex) {
                revert SignatureIndexesNotAscending();
            }
            lastIndex = sig.guardianIndex;

            /// Check to see if the signer of the signature does not match a specific Guardian key at the provided index
            if (
                ecrecover(hash, sig.v, sig.r, sig.s) !=
                guardianSet.keys[sig.guardianIndex]
            ) {
                return (false, "VM signature invalid");
            }
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
