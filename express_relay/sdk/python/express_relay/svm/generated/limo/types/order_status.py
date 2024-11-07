from __future__ import annotations
import typing
from dataclasses import dataclass
from anchorpy.borsh_extension import EnumForCodegen
import borsh_construct as borsh


class ActiveJSON(typing.TypedDict):
    kind: typing.Literal["Active"]


class FilledJSON(typing.TypedDict):
    kind: typing.Literal["Filled"]


class CancelledJSON(typing.TypedDict):
    kind: typing.Literal["Cancelled"]


@dataclass
class Active:
    discriminator: typing.ClassVar = 0
    kind: typing.ClassVar = "Active"

    @classmethod
    def to_json(cls) -> ActiveJSON:
        return ActiveJSON(
            kind="Active",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "Active": {},
        }


@dataclass
class Filled:
    discriminator: typing.ClassVar = 1
    kind: typing.ClassVar = "Filled"

    @classmethod
    def to_json(cls) -> FilledJSON:
        return FilledJSON(
            kind="Filled",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "Filled": {},
        }


@dataclass
class Cancelled:
    discriminator: typing.ClassVar = 2
    kind: typing.ClassVar = "Cancelled"

    @classmethod
    def to_json(cls) -> CancelledJSON:
        return CancelledJSON(
            kind="Cancelled",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "Cancelled": {},
        }


OrderStatusKind = typing.Union[Active, Filled, Cancelled]
OrderStatusJSON = typing.Union[ActiveJSON, FilledJSON, CancelledJSON]


def from_decoded(obj: dict) -> OrderStatusKind:
    if not isinstance(obj, dict):
        raise ValueError("Invalid enum object")
    if "Active" in obj:
        return Active()
    if "Filled" in obj:
        return Filled()
    if "Cancelled" in obj:
        return Cancelled()
    raise ValueError("Invalid enum object")


def from_json(obj: OrderStatusJSON) -> OrderStatusKind:
    if obj["kind"] == "Active":
        return Active()
    if obj["kind"] == "Filled":
        return Filled()
    if obj["kind"] == "Cancelled":
        return Cancelled()
    kind = obj["kind"]
    raise ValueError(f"Unrecognized enum kind: {kind}")


layout = EnumForCodegen(
    "Active" / borsh.CStruct(),
    "Filled" / borsh.CStruct(),
    "Cancelled" / borsh.CStruct(),
)
