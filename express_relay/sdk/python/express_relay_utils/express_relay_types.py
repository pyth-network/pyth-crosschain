from enum import Enum
from pydantic import BaseModel, field_validator, model_validator
from uuid import UUID
import web3
from typing import Union, Dict, Any
from pydantic import Field
from typing_extensions import Literal

from eth_account.datastructures import SignedMessage


def assert_hex_string(s: str):
    """
    Validates that a string is a valid hex string.

    Args:
        s: The string to validate as a hex string. Can be '0x'-prefixed.
    """
    if s.startswith("0x"):
        s = s[2:]

    s_set = set(s)
    hex_set = set("0123456789abcdefABCDEF")

    assert s_set.issubset(hex_set), "v must be a valid hex string"


class HexString(BaseModel):
    """
    Args:
        string: The string to validate as a hex string.
    """

    string: str

    @field_validator("string")
    @classmethod
    def check_hex(cls, v: str):
        assert_hex_string(v)

        return v


class Address(BaseModel):
    """
    Args:
        address: The string to validate as an Ethereum address.
    """

    address: str

    @field_validator("address")
    @classmethod
    def check_address(cls, v: str):
        assert web3.Web3.is_address(v), "s must be a valid Ethereum address"
        return v


class Bytes32(BaseModel):
    """
    Args:
        string: The hex string to validate as a 32-byte hash.
    """

    string: str

    @field_validator("string")
    @classmethod
    def check_bytes32(cls, v: str):
        assert_hex_string(v)
        assert len(v.replace("0x", "")) == 64, "permission key must be 32 bytes long"
        return v


class Bid(BaseModel):
    """
    Args:
        amount: The amount of the bid in wei.
        calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        contract: The contract address to call.
        permission_key: The permission key to bid on.
    """

    amount: int
    calldata: HexString
    chain_id: str
    contract: Address
    permission_key: HexString

    def to_dict(self):
        return {
            "amount": str(self.amount),
            "calldata": self.calldata.string,
            "chain_id": self.chain_id,
            "contract": self.contract.address,
            "permission_key": self.permission_key.string,
        }


class Status(Enum):
    SUBMITTED = "submitted"
    LOST = "lost"
    PENDING = "pending"


class BidStatus(BaseModel):
    """
    Args:
        status: The status tag, either 'submitted', 'lost', or 'pending'.
        result: The result of the bid: a transaction hash if the status is 'submitted', else None.
    """

    status: Status
    result: Bytes32 | None = Field(default=None)

    @model_validator(mode="after")
    def check_result(self):
        if self.status == Status("submitted"):
            assert self.result is not None, "result must be a valid 32-byte hash"
        else:
            assert self.result is None, "result must be None"
        return self


class BidStatusWithId(BaseModel):
    """
    Args:
        bid_status: The status of the bid.
        id: The ID of the bid.
    """

    bid_status: BidStatus
    id: UUID

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]):
        bid_status_dict = obj["bid_status"]
        status = bid_status_dict["status"]
        result = bid_status_dict.get("result")
        if result:
            result = Bytes32(string=result)
        obj["bid_status"] = BidStatus(status=status, result=result)
        obj["id"] = UUID(obj["id"])

        _obj = cls.model_validate({"bid_status": obj["bid_status"], "id": obj["id"]})

        return _obj


class OpportunityBid(BaseModel):
    """
    Args:
        amount: The amount of the bid in wei.
        liquidator: The address of the liquidator.
        permission_key: The permission key to bid on.
        signature: The signature of the bid.
        valid_until: The unix timestamp after which the bid becomes invalid.
    """

    amount: int
    liquidator: Address
    permission_key: HexString
    signature: SignedMessage
    valid_until: int

    model_config = {
        "arbitrary_types_allowed": True,
    }

    def to_dict(self):
        return {
            "amount": str(self.amount),
            "liquidator": self.liquidator.address,
            "permission_key": self.permission_key.string,
            "signature": bytes(self.signature.signature).hex(),
            "valid_until": str(self.valid_until),
        }


class OpportunityBidInfo(BaseModel):
    """
    Args:
        opportunity_id: The ID of the liquidation opportunity.
        opportunity_bid: The bid to submit on the liquidation opportunity.
    """

    opportunity_id: UUID
    opportunity_bid: OpportunityBid

    def to_dict(self):
        return {
            "opportunity_id": str(self.opportunity_id),
            "opportunity_bid": self.opportunity_bid.to_dict(),
        }


class TokenAmount(BaseModel):
    """
    Args:
        contract: The address of the token contract.
        amount: The amount of the token.
    """

    contract: Address
    amount: int


class OpportunityParamsV1(BaseModel):
    """
    Args:
        calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        contract: The contract address to call.
        permission_key: The permission key to bid on.
        receipt_tokens: The tokens to receive in the liquidation.
        repay_tokens: The tokens to repay in the liquidation.
        value: The value to send with the contract call.
        version: The version of the opportunity.
    """

    calldata: HexString
    chain_id: str
    contract: Address
    permission_key: HexString
    receipt_tokens: list[TokenAmount]
    repay_tokens: list[TokenAmount]
    value: int
    version: Literal["v1"]

    def to_dict(self):
        return {
            "calldata": self.calldata.string,
            "chain_id": self.chain_id,
            "contract": self.contract.address,
            "permission_key": self.permission_key.string,
            "receipt_tokens": [
                (token.contract.address, str(token.amount))
                for token in self.receipt_tokens
            ],
            "repay_tokens": [
                (token.contract.address, str(token.amount))
                for token in self.repay_tokens
            ],
            "value": str(self.value),
            "version": self.version,
        }


class OpportunityParams(BaseModel):
    """
    Args:
        params: The parameters of the opportunity.
    """

    params: Union[OpportunityParamsV1] = Field(..., discriminator="version")

    def to_dict(self):
        return self.params.to_dict()


class OpportunityParamsWithMetadata(BaseModel):
    """
    Args:
        calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        contract: The contract address to call.
        permission_key: The permission key to bid on.
        receipt_tokens: The tokens to receive in the liquidation.
        repay_tokens: The tokens to repay in the liquidation.
        value: The value to send with the contract call.
        version: The version of the opportunity.
        creation_time: The creation time of the opportunity.
        opportunity_id: The ID of the opportunity.
    """

    calldata: HexString
    chain_id: str
    contract: Address
    permission_key: HexString
    receipt_tokens: list[TokenAmount]
    repay_tokens: list[TokenAmount]
    value: int
    version: str
    creation_time: int
    opportunity_id: UUID

    @classmethod
    def from_dict(cls, obj: Dict[str, Any]):
        obj["calldata"] = HexString(string=obj["calldata"])
        obj["contract"] = Address(address=obj["contract"])
        obj["permission_key"] = HexString(string=obj["permission_key"])
        obj["receipt_tokens"] = [
            TokenAmount(
                contract=Address(address=token["contract"]), amount=token["amount"]
            )
            for token in obj["receipt_tokens"]
        ]
        obj["repay_tokens"] = [
            TokenAmount(
                contract=Address(address=token["contract"]), amount=token["amount"]
            )
            for token in obj["repay_tokens"]
        ]
        obj["opportunity_id"] = UUID(obj["opportunity_id"])

        _obj = cls.model_validate(
            {
                "calldata": obj["calldata"],
                "chain_id": obj["chain_id"],
                "contract": obj["contract"],
                "permission_key": obj["permission_key"],
                "receipt_tokens": obj["receipt_tokens"],
                "repay_tokens": obj["repay_tokens"],
                "value": obj["value"],
                "version": obj["version"],
                "creation_time": obj["creation_time"],
                "opportunity_id": obj["opportunity_id"],
            }
        )

        return _obj


class SubscribeMessage(BaseModel):
    """
    Args:
        method: A string literal "subscribe".
        chain_ids: The chain IDs to subscribe to.
    """

    method: Literal["subscribe"]
    chain_ids: list[str]

    def to_dict(self):
        return {"method": str(self.method), "params": {"chain_ids": self.chain_ids}}


class UnsubscribeMessage(BaseModel):
    """
    Args:
        method: A string literal "unsubscribe".
        chain_ids: The chain IDs to subscribe to.
    """

    method: Literal["unsubscribe"]
    chain_ids: list[str]

    def to_dict(self):
        return {"method": str(self.method), "params": {"chain_ids": self.chain_ids}}


class PostBidMessage(BaseModel):
    """
    Args:
        method: A string literal "post_bid".
        bid: The bid to post.
    """

    method: Literal["post_bid"]
    bid: Bid

    def to_dict(self):
        return {"method": str(self.method), "params": {"bid": self.bid.to_dict()}}


class PostLiquidationBidMessage(BaseModel):
    """
    Args:
        method: A string literal "post_liquidation_bid".
        opportunity_id: The ID of the opportunity.
        opportunity_bid: The bid to post on the opportunity.
    """

    method: Literal["post_liquidation_bid"]
    opportunity_id: UUID
    opportunity_bid: OpportunityBid

    def to_dict(self):
        return {
            "method": str(self.method),
            "params": {
                "opportunity_id": str(self.opportunity_id),
                "opportunity_bid": self.opportunity_bid.to_dict(),
            },
        }


class ClientMessage(BaseModel):
    """
    Args:
        params: The parameters of the message.
    """

    params: Union[
        SubscribeMessage, UnsubscribeMessage, PostBidMessage, PostLiquidationBidMessage
    ] = Field(..., discriminator="method")

    def to_dict(self):
        return self.params.to_dict()
