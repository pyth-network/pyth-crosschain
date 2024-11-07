import string
from datetime import datetime
from typing import ClassVar

import web3
from eth_account.datastructures import SignedMessage
from pydantic import BaseModel, model_validator, Field
from pydantic.functional_serializers import PlainSerializer
from pydantic.functional_validators import AfterValidator
from typing_extensions import Annotated

from express_relay.models.base import (
    IntString,
    UUIDString,
    UnsupportedOpportunityVersionException,
    BidStatus,
)


def check_hex_string(s: str):
    """
    Validates that a string is a valid hex string.

    Args:
        s: The string to validate as a hex string. Can be '0x'-prefixed.
    """
    ind = 0
    if s.startswith("0x"):
        ind = 2

    assert all(
        c in string.hexdigits for c in s[ind:]
    ), "string is not a valid hex string"

    return s


def check_bytes32(s: str):
    """
    Validates that a string is a valid 32-byte hex string.

    Args:
        s: The string to validate as a 32-byte hex string. Can be '0x'-prefixed.
    """
    check_hex_string(s)
    ind = 0
    if s.startswith("0x"):
        ind = 2

    assert len(s[ind:]) == 64, "hex string is not 32 bytes long"

    return s


def check_address(s: str):
    """
    Validates that a string is a valid Ethereum address.

    Args:
        s: The string to validate as an Ethereum address. Can be '0x'-prefixed.
    """
    assert web3.Web3.is_address(s), "string is not a valid Ethereum address"
    return s


HexString = Annotated[str, AfterValidator(check_hex_string)]
Bytes32 = Annotated[str, AfterValidator(check_bytes32)]
Address = Annotated[str, AfterValidator(check_address)]

SignedMessageString = Annotated[
    SignedMessage, PlainSerializer(lambda x: bytes(x.signature).hex(), return_type=str)
]


class TokenAmount(BaseModel):
    """
    Attributes:
        token: The address of the token contract.
        amount: The amount of the token.
    """

    token: Address
    amount: IntString


class BidEvm(BaseModel):
    """
    Attributes:
        amount: The amount of the bid in wei.
        target_calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        target_contract: The contract address to call.
        permission_key: The permission key to bid on.
    """

    amount: IntString
    target_calldata: HexString
    chain_id: str
    target_contract: Address
    permission_key: HexString


class OpportunityEvm(BaseModel):
    """
    Attributes:
        target_calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        target_contract: The contract address to call.
        permission_key: The permission key to bid on.
        buy_tokens: The tokens to receive in the opportunity.
        sell_tokens: The tokens to spend in the opportunity.
        target_call_value: The value to send with the contract call.
        version: The version of the opportunity.
        creation_time: The creation time of the opportunity.
        opportunity_id: The ID of the opportunity.
    """

    target_calldata: HexString
    chain_id: str
    target_contract: Address
    permission_key: HexString
    buy_tokens: list[TokenAmount]
    sell_tokens: list[TokenAmount]
    target_call_value: IntString
    version: str
    creation_time: IntString
    opportunity_id: UUIDString

    supported_versions: ClassVar[list[str]] = ["v1"]

    @model_validator(mode="before")
    @classmethod
    def check_version(cls, data):
        if data["version"] not in cls.supported_versions:
            raise UnsupportedOpportunityVersionException(
                f"Cannot handle opportunity version: {data['version']}. Please upgrade your client."
            )
        return data


class BidStatusEvm(BaseModel):
    """
    Attributes:
        type: The current status of the bid.
        result: The result of the bid: a transaction hash if the status is SUBMITTED or WON.
                The LOST status may have a result.
        index: The index of the bid in the submitted transaction.
    """

    type: BidStatus
    result: Bytes32 | None = Field(default=None)
    index: int | None = Field(default=None)

    @model_validator(mode="after")
    def check_result(self):
        if self.type == BidStatus.PENDING:
            assert self.result is None, "result must be None"
        elif self.type == BidStatus.LOST:
            pass
        else:
            assert self.result is not None, "result must be a valid 32-byte hash"
        return self

    @model_validator(mode="after")
    def check_index(self):
        if self.type == BidStatus.SUBMITTED or self.type == BidStatus.WON:
            assert self.index is not None, "index must be a valid integer"
        elif self.type == BidStatus.LOST:
            pass
        else:
            assert self.index is None, "index must be None"
        return self


class BidResponseEvm(BaseModel):
    """
    Attributes:
        id: The unique id for bid.
        amount: The amount of the bid in wei.
        target_calldata: Calldata for the contract call.
        chain_id: The chain ID to bid on.
        target_contract: The contract address to call.
        permission_key: The permission key to bid on.
        status: The latest status for bid.
        initiation_time: The time server received the bid formatted in rfc3339.
        profile_id: The profile id for the bid owner.
        gas_limit: The gas limit for the bid.
    """

    id: UUIDString
    bid_amount: IntString
    target_calldata: HexString
    chain_id: str
    target_contract: Address
    permission_key: HexString
    status: BidStatusEvm
    initiation_time: datetime
    profile_id: str | None = Field(default=None)
    gas_limit: IntString
