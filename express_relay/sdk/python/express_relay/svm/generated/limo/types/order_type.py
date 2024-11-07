from __future__ import annotations
import typing
from dataclasses import dataclass
from anchorpy.borsh_extension import EnumForCodegen
import borsh_construct as borsh


class ExactInJSON(typing.TypedDict):
    kind: typing.Literal["ExactIn"]


class ExactOutJSON(typing.TypedDict):
    kind: typing.Literal["ExactOut"]


@dataclass
class ExactIn:
    discriminator: typing.ClassVar = 0
    kind: typing.ClassVar = "ExactIn"

    @classmethod
    def to_json(cls) -> ExactInJSON:
        return ExactInJSON(
            kind="ExactIn",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "ExactIn": {},
        }


@dataclass
class ExactOut:
    discriminator: typing.ClassVar = 1
    kind: typing.ClassVar = "ExactOut"

    @classmethod
    def to_json(cls) -> ExactOutJSON:
        return ExactOutJSON(
            kind="ExactOut",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "ExactOut": {},
        }


OrderTypeKind = typing.Union[ExactIn, ExactOut]
OrderTypeJSON = typing.Union[ExactInJSON, ExactOutJSON]


def from_decoded(obj: dict) -> OrderTypeKind:
    if not isinstance(obj, dict):
        raise ValueError("Invalid enum object")
    if "ExactIn" in obj:
        return ExactIn()
    if "ExactOut" in obj:
        return ExactOut()
    raise ValueError("Invalid enum object")


def from_json(obj: OrderTypeJSON) -> OrderTypeKind:
    if obj["kind"] == "ExactIn":
        return ExactIn()
    if obj["kind"] == "ExactOut":
        return ExactOut()
    kind = obj["kind"]
    raise ValueError(f"Unrecognized enum kind: {kind}")


layout = EnumForCodegen("ExactIn" / borsh.CStruct(), "ExactOut" / borsh.CStruct())
