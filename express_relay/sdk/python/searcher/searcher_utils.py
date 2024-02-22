from typing import TypedDict

import web3
from eth_abi import encode
from eth_account.datastructures import SignedMessage
from web3.auto import w3


class BidInfo(TypedDict):
    bid: int
    valid_until: int


def construct_signature_liquidator(
    repay_tokens: list[(str, int)],
    receipt_tokens: list[(str, int)],
    address: str,
    liq_calldata: bytes,
    value: int,
    bid_info: BidInfo,
    secret_key: str,
) -> SignedMessage:
    """
    Constructs a signature for a liquidator's bid to submit to the liquidation server.

    Args:
        repay_tokens: A list of tuples (token address, amount) representing the tokens to repay.
        receipt_tokens: A list of tuples (token address, amount) representing the tokens to receive.
        address: The address of the protocol contract for the liquidation.
        liq_calldata: The calldata for the liquidation method call.
        value: The value for the liquidation method call.
        bid: The amount of native token to bid on this opportunity.
        valid_until: The timestamp at which the transaction will expire.
        secret_key: A 0x-prefixed hex string representing the liquidator's private key.
    Returns:
        A SignedMessage object, representing the liquidator's signature.
    """

    digest = encode(
        [
            "(address,uint256)[]",
            "(address,uint256)[]",
            "address",
            "bytes",
            "uint256",
            "uint256",
            "uint256",
        ],
        [
            repay_tokens,
            receipt_tokens,
            address,
            liq_calldata,
            value,
            bid_info["bid"],
            bid_info["valid_until"],
        ],
    )
    msg_data = web3.Web3.solidity_keccak(["bytes"], [digest])
    signature = w3.eth.account.signHash(msg_data, private_key=secret_key)

    return signature
