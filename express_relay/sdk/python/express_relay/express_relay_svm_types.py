import base64
from typing import Any, Annotated, ClassVar

from pydantic import (
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
    BaseModel,
    model_validator,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from solders.hash import Hash as _SvmHash
from solders.signature import Signature as _SvmSignature
from solders.pubkey import Pubkey as _SvmAddress
from solders.transaction import Transaction as _SvmTransaction

from express_relay.express_relay_types import (
    IntString,
    UUIDString,
    UnsupportedOpportunityVersionException,
)
from express_relay.svm.generated.limo.accounts import Order


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
        blockHash: The block hash to use for execution.
        slot: The slot where this order was created or updated
        program: The program which handles this opportunity
        order: The order to be executed.
        order_address: The address of the order.
    """

    chain_id: str
    version: str
    creation_time: IntString
    opportunity_id: UUIDString

    blockHash: SvmHash
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
