import base64
from datetime import datetime
from typing import Any, Annotated, ClassVar

from pydantic import (
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
    BaseModel,
    model_validator,
    Field,
    Base64Bytes,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from solders.hash import Hash as _SvmHash
from solders.pubkey import Pubkey as _SvmAddress
from solders.signature import Signature as _SvmSignature
from solders.transaction import Transaction as _SvmTransaction

from express_relay.svm.generated.limo.accounts.order import Order
from express_relay.models.base import (
    IntString,
    UUIDString,
    UnsupportedOpportunityVersionException,
    BidStatus,
)


class _TransactionPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(value: str) -> _SvmTransaction:
            return _SvmTransaction.from_bytes(base64.b64decode(value))

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # check if it's an instance first before doing any further work
                    core_schema.is_instance_schema(_SvmTransaction),
                    from_str_schema,
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda instance: base64.b64encode(bytes(instance)).decode("utf-8")
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # Use the same schema that would be used for `str`
        return handler(core_schema.str_schema())


class _SvmAddressPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(value: str) -> _SvmAddress:
            return _SvmAddress.from_string(value)

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # check if it's an instance first before doing any further work
                    core_schema.is_instance_schema(_SvmTransaction),
                    from_str_schema,
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda instance: str(instance)
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # Use the same schema that would be used for `str`
        return handler(core_schema.str_schema())


class _HashPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(value: str) -> _SvmHash:
            return _SvmHash.from_string(value)

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # check if it's an instance first before doing any further work
                    core_schema.is_instance_schema(Order),
                    from_str_schema,
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(str),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # Use the same schema that would be used for `str`
        return handler(core_schema.str_schema())


class _SignaturePydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(value: str) -> _SvmSignature:
            return _SvmSignature.from_string(value)

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # check if it's an instance first before doing any further work
                    core_schema.is_instance_schema(Order),
                    from_str_schema,
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(str),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # Use the same schema that would be used for `str`
        return handler(core_schema.str_schema())


SvmTransaction = Annotated[_SvmTransaction, _TransactionPydanticAnnotation]
SvmAddress = Annotated[_SvmAddress, _SvmAddressPydanticAnnotation]
SvmHash = Annotated[_SvmHash, _HashPydanticAnnotation]
SvmSignature = Annotated[_SvmSignature, _SignaturePydanticAnnotation]


class BidSvm(BaseModel):
    """
    Attributes:
        transaction: The transaction including the bid
        chain_id: The chain ID to bid on.
    """

    transaction: SvmTransaction
    chain_id: str


class _OrderPydanticAnnotation:
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate_from_str(value: str) -> Order:
            return Order.decode(base64.b64decode(value))

        from_str_schema = core_schema.chain_schema(
            [
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(validate_from_str),
            ]
        )

        return core_schema.json_or_python_schema(
            json_schema=from_str_schema,
            python_schema=core_schema.union_schema(
                [
                    # check if it's an instance first before doing any further work
                    core_schema.is_instance_schema(Order),
                    from_str_schema,
                ]
            ),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda instance: base64.b64encode(Order.layout.build(instance)).decode(
                    "utf-8"
                )
            ),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        # Use the same schema that would be used for `str`
        return handler(core_schema.str_schema())


class OpportunitySvm(BaseModel):
    """
    Attributes:
        chain_id: The chain ID to bid on.
        version: The version of the opportunity.
        creation_time: The creation time of the opportunity.
        opportunity_id: The ID of the opportunity.
        block_hash: The block hash to use for execution.
        slot: The slot where this order was created or updated
        program: The program which handles this opportunity
        order: The order to be executed.
        order_address: The address of the order.
    """

    chain_id: str
    version: str
    creation_time: IntString
    opportunity_id: UUIDString

    block_hash: SvmHash
    slot: int

    program: str
    order: Annotated[Order, _OrderPydanticAnnotation]
    order_address: SvmAddress

    supported_versions: ClassVar[list[str]] = ["v1"]
    supported_programs: ClassVar[list[str]] = ["limo"]

    @model_validator(mode="before")
    @classmethod
    def check_version(cls, data):
        if data["version"] not in cls.supported_versions:
            raise UnsupportedOpportunityVersionException(
                f"Cannot handle opportunity version: {data['version']}. Please upgrade your client."
            )
        return data


class BidStatusSvm(BaseModel):
    """
    Attributes:
        type: The current status of the bid.
        result: The result of the bid: a transaction hash if the status is SUBMITTED or WON.
                The LOST status may have a result.
    """

    type: BidStatus
    result: SvmSignature | None = Field(default=None)

    @model_validator(mode="after")
    def check_result(self):
        if self.type == BidStatus.WON or self.type == BidStatus.SUBMITTED:
            assert (
                self.result is not None
            ), "bid result should not be empty when status is won or submitted"
        return self


class BidResponseSvm(BaseModel):
    """
    Attributes:
        id: The unique id for bid.
        bid_amount: The amount of the bid in lamports.
        chain_id: The chain ID to bid on.
        permission_key: The permission key to bid on.
        status: The latest status for bid.
        initiation_time: The time server received the bid formatted in rfc3339.
        profile_id: The profile id for the bid owner.
    """

    id: UUIDString
    bid_amount: int
    chain_id: str
    permission_key: Base64Bytes
    status: BidStatusSvm
    initiation_time: datetime
    transaction: SvmTransaction
    profile_id: str | None = Field(default=None)
