from __future__ import annotations
import typing
from dataclasses import dataclass
from solders.pubkey import Pubkey
from anchorpy.borsh_extension import EnumForCodegen, BorshPubkey
import borsh_construct as borsh

BoolJSONValue = tuple[bool]
U16JSONValue = tuple[int]
PubkeyJSONValue = tuple[str]
BoolValue = tuple[bool]
U16Value = tuple[int]
PubkeyValue = tuple[Pubkey]


class BoolJSON(typing.TypedDict):
    value: BoolJSONValue
    kind: typing.Literal["Bool"]


class U16JSON(typing.TypedDict):
    value: U16JSONValue
    kind: typing.Literal["U16"]


class PubkeyJSON(typing.TypedDict):
    value: PubkeyJSONValue
    kind: typing.Literal["Pubkey"]


@dataclass
class Bool:
    discriminator: typing.ClassVar = 0
    kind: typing.ClassVar = "Bool"
    value: BoolValue

    def to_json(self) -> BoolJSON:
        return BoolJSON(
            kind="Bool",
            value=(self.value[0],),
        )

    def to_encodable(self) -> dict:
        return {
            "Bool": {
                "item_0": self.value[0],
            },
        }


@dataclass
class U16:
    discriminator: typing.ClassVar = 1
    kind: typing.ClassVar = "U16"
    value: U16Value

    def to_json(self) -> U16JSON:
        return U16JSON(
            kind="U16",
            value=(self.value[0],),
        )

    def to_encodable(self) -> dict:
        return {
            "U16": {
                "item_0": self.value[0],
            },
        }


@dataclass
class Pubkey:
    discriminator: typing.ClassVar = 2
    kind: typing.ClassVar = "Pubkey"
    value: PubkeyValue

    def to_json(self) -> PubkeyJSON:
        return PubkeyJSON(
            kind="Pubkey",
            value=(str(self.value[0]),),
        )

    def to_encodable(self) -> dict:
        return {
            "Pubkey": {
                "item_0": self.value[0],
            },
        }


UpdateGlobalConfigValueKind = typing.Union[Bool, U16, Pubkey]
UpdateGlobalConfigValueJSON = typing.Union[BoolJSON, U16JSON, PubkeyJSON]


def from_decoded(obj: dict) -> UpdateGlobalConfigValueKind:
    if not isinstance(obj, dict):
        raise ValueError("Invalid enum object")
    if "Bool" in obj:
        val = obj["Bool"]
        return Bool((val["item_0"],))
    if "U16" in obj:
        val = obj["U16"]
        return U16((val["item_0"],))
    if "Pubkey" in obj:
        val = obj["Pubkey"]
        return Pubkey((val["item_0"],))
    raise ValueError("Invalid enum object")


def from_json(obj: UpdateGlobalConfigValueJSON) -> UpdateGlobalConfigValueKind:
    if obj["kind"] == "Bool":
        bool_json_value = typing.cast(BoolJSONValue, obj["value"])
        return Bool((bool_json_value[0],))
    if obj["kind"] == "U16":
        u16json_value = typing.cast(U16JSONValue, obj["value"])
        return U16((u16json_value[0],))
    if obj["kind"] == "Pubkey":
        pubkey_json_value = typing.cast(PubkeyJSONValue, obj["value"])
        return Pubkey((Pubkey.from_string(pubkey_json_value[0]),))
    kind = obj["kind"]
    raise ValueError(f"Unrecognized enum kind: {kind}")


layout = EnumForCodegen(
    "Bool" / borsh.CStruct("item_0" / borsh.Bool),
    "U16" / borsh.CStruct("item_0" / borsh.U16),
    "Pubkey" / borsh.CStruct("item_0" / BorshPubkey),
)
