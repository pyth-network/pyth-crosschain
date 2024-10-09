from datetime import datetime
from enum import Enum
from pydantic import (
    BaseModel,
    model_validator,
    Tag,
    Discriminator,
    RootModel,
)
from pydantic.functional_validators import AfterValidator
from pydantic.functional_serializers import PlainSerializer
from uuid import UUID
import web3
from typing import Union, ClassVar, Any
from pydantic import Field
from typing_extensions import Literal, Annotated
import warnings
import string
from eth_account.datastructures import SignedMessage

from express_relay.express_relay_svm_types import (
    SvmTransaction,
    SvmSignature,
    OpportunitySvm,
)


class UnsupportedOpportunityVersionException(Exception):
    pass


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

IntString = Annotated[int, PlainSerializer(lambda x: str(x), return_type=str)]
UUIDString = Annotated[UUID, PlainSerializer(lambda x: str(x), return_type=str)]
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


class BidSvm(BaseModel):
    """
    Attributes:
        transaction: The transaction including the bid
        chain_id: The chain ID to bid on.
    """

    transaction: SvmTransaction
    chain_id: str


Bid = Union[BidEvm, BidSvm]


class BidStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    LOST = "lost"
    WON = "won"


class BidStatusUpdate(BaseModel):
    """
    Attributes:
        id: The ID of the bid.
        bid_status: The current status of the bid.
        result: The result of the bid: a transaction hash if the status is SUBMITTED or WON. The LOST status may have a result.
        index: The index of the bid in the submitted transaction.
    """

    id: UUIDString
    bid_status: BidStatus
    result: Bytes32 | SvmSignature | None = Field(default=None)
    index: int | None = Field(default=None)

    @model_validator(mode="after")
    def check_result(self):
        if self.bid_status == BidStatus("pending"):
            assert self.result is None, "result must be None"
        elif self.bid_status == BidStatus("lost"):
            pass
        else:
            assert self.result is not None, "result must be a valid 32-byte hash"
        return self

    @model_validator(mode="after")
    def check_index(self):
        if isinstance(self.result, SvmSignature):
            return self
        if self.bid_status == BidStatus("submitted") or self.bid_status == BidStatus(
            "won"
        ):
            assert self.index is not None, "index must be a valid integer"
        elif self.bid_status == BidStatus("lost"):
            pass
        else:
            assert self.index is None, "index must be None"
        return self

    @classmethod
    def process_bid_status_dict(cls, bid_status_dict: dict):
        """
        Processes a bid status dictionary and converts to a class object.

        Args:
            bid_status_dict: The bid status dictionary to convert.

        Returns:
            The bid status as a class object.
        """
        try:
            return cls.model_validate(
                dict(
                    id=bid_status_dict.get("id"),
                    bid_status=bid_status_dict.get("bid_status", {}).pop("type"),
                    **bid_status_dict.get("bid_status", {}),
                )
            )
        except Exception as e:
            warnings.warn(str(e))
            return None


class BidResponse(BaseModel):
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
    status: BidStatusUpdate
    initiation_time: datetime
    profile_id: str | None = Field(default=None)
    gas_limit: IntString

    @classmethod
    def process_bid_response_dict(cls, bid_response_dict: dict):
        """
        Processes a bid response dictionary and converts to a class object.

        Args:
            bid_response_dict: The bid response dictionary to convert.

        Returns:
            The bid response as a class object.
        """
        try:
            return cls.model_validate(
                dict(
                    status=BidStatusUpdate.process_bid_status_dict(
                        dict(
                            id=bid_response_dict.get("id"),
                            bid_status=bid_response_dict.pop("status"),
                        )
                    ),
                    initiation_time=datetime.fromisoformat(
                        bid_response_dict.pop("initiation_time")
                    ),
                    **bid_response_dict,
                )
            )
        except UnsupportedOpportunityVersionException as e:
            warnings.warn(str(e))
            return None


class OpportunityBidParams(BaseModel):
    """
    Attributes:
        amount: The amount of the bid in wei.
        nonce: The nonce of the bid.
        deadline: The unix timestamp after which the bid becomes invalid.
    """

    amount: IntString
    nonce: IntString
    deadline: IntString


class OpportunityBid(BaseModel):
    """
    Attributes:
        opportunity_id: The ID of the opportunity.
        amount: The amount of the bid in wei.
        executor: The address of the executor.
        permission_key: The permission key to bid on.
        signature: The signature of the bid.
        deadline: The unix timestamp after which the bid becomes invalid.
        nonce: The nonce of the bid.
    """

    opportunity_id: UUIDString
    amount: IntString
    executor: Address
    permission_key: HexString
    signature: SignedMessageString
    deadline: IntString
    nonce: IntString

    model_config = {
        "arbitrary_types_allowed": True,
    }


class OpportunityParamsV1(BaseModel):
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
    """

    target_calldata: HexString
    chain_id: str
    target_contract: Address
    permission_key: HexString
    buy_tokens: list[TokenAmount]
    sell_tokens: list[TokenAmount]
    target_call_value: IntString
    version: Literal["v1"]


class OpportunityParams(BaseModel):
    """
    Attributes:
        params: The parameters of the opportunity.
    """

    params: Union[OpportunityParamsV1] = Field(..., discriminator="version")


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


Opportunity = Union[OpportunityEvm, OpportunitySvm]
OpportunityRoot = RootModel[Opportunity]


class SubscribeMessageParams(BaseModel):
    """
    Attributes:
        method: A string literal "subscribe".
        chain_ids: The chain IDs to subscribe to.
    """

    method: Literal["subscribe"]
    chain_ids: list[str]


class UnsubscribeMessageParams(BaseModel):
    """
    Attributes:
        method: A string literal "unsubscribe".
        chain_ids: The chain IDs to subscribe to.
    """

    method: Literal["unsubscribe"]
    chain_ids: list[str]


class PostBidMessageParamsEvm(BaseModel):
    """
    Attributes:
        method: A string literal "post_bid".
        amount: The amount of the bid in wei.
        target_calldata: The calldata for the contract call.
        chain_id: The chain ID to bid on.
        target_contract: The contract address to call.
        permission_key: The permission key to bid on.
    """

    method: Literal["post_bid"]
    amount: IntString
    target_calldata: HexString
    chain_id: str
    target_contract: Address
    permission_key: HexString


class PostBidMessageParamsSvm(BaseModel):
    """
    Attributes:
        method: A string literal "post_bid".
        chain_id: The chain ID to bid on.
        transaction: The transaction including the bid.
    """

    method: Literal["post_bid"]
    chain_id: str
    transaction: SvmTransaction


def get_discriminator_value(v: Any) -> str:
    if isinstance(v, dict):
        if "transaction" in v:
            return "svm"
        return "evm"
    if getattr(v, "transaction", None):
        return "svm"
    return "evm"


PostBidMessageParams = Annotated[
    Union[
        Annotated[PostBidMessageParamsEvm, Tag("evm")],
        Annotated[PostBidMessageParamsSvm, Tag("svm")],
    ],
    Discriminator(get_discriminator_value),
]


class PostOpportunityBidMessageParams(BaseModel):
    """
    Attributes:
        method: A string literal "post_opportunity_bid".
        opportunity_id: The ID of the opportunity.
        amount: The amount of the bid in wei.
        executor: The address of the executor.
        permission_key: The permission key to bid on.
        signature: The signature of the bid.
        deadline: The unix timestamp after which the bid becomes invalid.
        nonce: The nonce of the bid.
    """

    method: Literal["post_opportunity_bid"]
    opportunity_id: UUIDString
    amount: IntString
    executor: Address
    permission_key: HexString
    signature: SignedMessageString
    deadline: IntString
    nonce: IntString

    model_config = {
        "arbitrary_types_allowed": True,
    }


class ClientMessage(BaseModel):
    """
    Attributes:
        params: The parameters of the message.
    """

    params: Union[
        SubscribeMessageParams,
        UnsubscribeMessageParams,
        PostBidMessageParams,
        PostOpportunityBidMessageParams,
    ] = Field(..., discriminator="method")


class OpportunityAdapterConfig(BaseModel):
    """
    Attributes:
        chain_id: The chain ID.
        opportunity_adapter_factory: The address of the opportunity adapter factory contract.
        opportunity_adapter_init_bytecode_hash: The hash of the init bytecode of the opportunity adapter.
        permit2: The address of the permit2 contract.
        weth: The address of the WETH contract.
    """

    chain_id: int
    opportunity_adapter_factory: Address
    opportunity_adapter_init_bytecode_hash: Bytes32
    permit2: Address
    weth: Address
