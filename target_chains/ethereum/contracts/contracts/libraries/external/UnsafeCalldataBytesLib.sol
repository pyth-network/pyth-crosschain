// SPDX-License-Identifier: Unlicense
/*
 * @title Solidity Bytes Arrays Utils
 * @author Gonçalo Sá <goncalo.sa@consensys.net>
 *
 * @dev Bytes tightly packed arrays utility library for ethereum contracts written in Solidity.
 *      The library lets you concatenate, slice and type cast bytes arrays both in memory and storage.
 *
 * @notice This is the **unsafe** version of BytesLib which removed all the checks (out of bound, ...)
 * to be more gas efficient.
 */
pragma solidity >=0.8.0 <0.9.0;

library UnsafeCalldataBytesLib {
    function slice(
        bytes calldata _bytes,
        uint256 _start,
        uint256 _length
    ) internal pure returns (bytes calldata) {
        return _bytes[_start:_start + _length];
    }

    function sliceFrom(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (bytes calldata) {
        return _bytes[_start:_bytes.length];
    }

    function toAddress(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (address) {
        address tempAddress;

        assembly {
            tempAddress := shr(96, calldataload(add(_bytes.offset, _start)))
        }

        return tempAddress;
    }

    function toUint8(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint8) {
        uint8 tempUint;

        assembly {
            tempUint := shr(248, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint16(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint16) {
        uint16 tempUint;

        assembly {
            tempUint := shr(240, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint32(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint32) {
        uint32 tempUint;

        assembly {
            tempUint := shr(224, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint64(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint64) {
        uint64 tempUint;

        assembly {
            tempUint := shr(192, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint96(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint96) {
        uint96 tempUint;

        assembly {
            tempUint := shr(160, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint128(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint128) {
        uint128 tempUint;

        assembly {
            tempUint := shr(128, calldataload(add(_bytes.offset, _start)))
        }

        return tempUint;
    }

    function toUint256(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (uint256) {
        uint256 tempUint;

        assembly {
            tempUint := calldataload(add(_bytes.offset, _start))
        }

        return tempUint;
    }

    function toBytes32(
        bytes calldata _bytes,
        uint256 _start
    ) internal pure returns (bytes32) {
        bytes32 tempBytes32;

        assembly {
            tempBytes32 := calldataload(add(_bytes.offset, _start))
        }

        return tempBytes32;
    }
}
