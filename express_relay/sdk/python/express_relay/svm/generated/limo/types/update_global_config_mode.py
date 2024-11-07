from __future__ import annotations
import typing
from dataclasses import dataclass
from anchorpy.borsh_extension import EnumForCodegen
import borsh_construct as borsh


class UpdateEmergencyModeJSON(typing.TypedDict):
    kind: typing.Literal["UpdateEmergencyMode"]


class UpdateBlockLocalAdminsJSON(typing.TypedDict):
    kind: typing.Literal["UpdateBlockLocalAdmins"]


class UpdateBlockNewOrdersJSON(typing.TypedDict):
    kind: typing.Literal["UpdateBlockNewOrders"]


class UpdateBlockOrdersTakingJSON(typing.TypedDict):
    kind: typing.Literal["UpdateBlockOrdersTaking"]


class UpdateHostFeeBpsJSON(typing.TypedDict):
    kind: typing.Literal["UpdateHostFeeBps"]


class UpdateAdminAuthorityJSON(typing.TypedDict):
    kind: typing.Literal["UpdateAdminAuthority"]


@dataclass
class UpdateEmergencyMode:
    discriminator: typing.ClassVar = 0
    kind: typing.ClassVar = "UpdateEmergencyMode"

    @classmethod
    def to_json(cls) -> UpdateEmergencyModeJSON:
        return UpdateEmergencyModeJSON(
            kind="UpdateEmergencyMode",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateEmergencyMode": {},
        }


@dataclass
class UpdateBlockLocalAdmins:
    discriminator: typing.ClassVar = 1
    kind: typing.ClassVar = "UpdateBlockLocalAdmins"

    @classmethod
    def to_json(cls) -> UpdateBlockLocalAdminsJSON:
        return UpdateBlockLocalAdminsJSON(
            kind="UpdateBlockLocalAdmins",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateBlockLocalAdmins": {},
        }


@dataclass
class UpdateBlockNewOrders:
    discriminator: typing.ClassVar = 2
    kind: typing.ClassVar = "UpdateBlockNewOrders"

    @classmethod
    def to_json(cls) -> UpdateBlockNewOrdersJSON:
        return UpdateBlockNewOrdersJSON(
            kind="UpdateBlockNewOrders",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateBlockNewOrders": {},
        }


@dataclass
class UpdateBlockOrdersTaking:
    discriminator: typing.ClassVar = 3
    kind: typing.ClassVar = "UpdateBlockOrdersTaking"

    @classmethod
    def to_json(cls) -> UpdateBlockOrdersTakingJSON:
        return UpdateBlockOrdersTakingJSON(
            kind="UpdateBlockOrdersTaking",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateBlockOrdersTaking": {},
        }


@dataclass
class UpdateHostFeeBps:
    discriminator: typing.ClassVar = 4
    kind: typing.ClassVar = "UpdateHostFeeBps"

    @classmethod
    def to_json(cls) -> UpdateHostFeeBpsJSON:
        return UpdateHostFeeBpsJSON(
            kind="UpdateHostFeeBps",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateHostFeeBps": {},
        }


@dataclass
class UpdateAdminAuthority:
    discriminator: typing.ClassVar = 5
    kind: typing.ClassVar = "UpdateAdminAuthority"

    @classmethod
    def to_json(cls) -> UpdateAdminAuthorityJSON:
        return UpdateAdminAuthorityJSON(
            kind="UpdateAdminAuthority",
        )

    @classmethod
    def to_encodable(cls) -> dict:
        return {
            "UpdateAdminAuthority": {},
        }


UpdateGlobalConfigModeKind = typing.Union[
    UpdateEmergencyMode,
    UpdateBlockLocalAdmins,
    UpdateBlockNewOrders,
    UpdateBlockOrdersTaking,
    UpdateHostFeeBps,
    UpdateAdminAuthority,
]
UpdateGlobalConfigModeJSON = typing.Union[
    UpdateEmergencyModeJSON,
    UpdateBlockLocalAdminsJSON,
    UpdateBlockNewOrdersJSON,
    UpdateBlockOrdersTakingJSON,
    UpdateHostFeeBpsJSON,
    UpdateAdminAuthorityJSON,
]


def from_decoded(obj: dict) -> UpdateGlobalConfigModeKind:
    if not isinstance(obj, dict):
        raise ValueError("Invalid enum object")
    if "UpdateEmergencyMode" in obj:
        return UpdateEmergencyMode()
    if "UpdateBlockLocalAdmins" in obj:
        return UpdateBlockLocalAdmins()
    if "UpdateBlockNewOrders" in obj:
        return UpdateBlockNewOrders()
    if "UpdateBlockOrdersTaking" in obj:
        return UpdateBlockOrdersTaking()
    if "UpdateHostFeeBps" in obj:
        return UpdateHostFeeBps()
    if "UpdateAdminAuthority" in obj:
        return UpdateAdminAuthority()
    raise ValueError("Invalid enum object")


def from_json(obj: UpdateGlobalConfigModeJSON) -> UpdateGlobalConfigModeKind:
    if obj["kind"] == "UpdateEmergencyMode":
        return UpdateEmergencyMode()
    if obj["kind"] == "UpdateBlockLocalAdmins":
        return UpdateBlockLocalAdmins()
    if obj["kind"] == "UpdateBlockNewOrders":
        return UpdateBlockNewOrders()
    if obj["kind"] == "UpdateBlockOrdersTaking":
        return UpdateBlockOrdersTaking()
    if obj["kind"] == "UpdateHostFeeBps":
        return UpdateHostFeeBps()
    if obj["kind"] == "UpdateAdminAuthority":
        return UpdateAdminAuthority()
    kind = obj["kind"]
    raise ValueError(f"Unrecognized enum kind: {kind}")


layout = EnumForCodegen(
    "UpdateEmergencyMode" / borsh.CStruct(),
    "UpdateBlockLocalAdmins" / borsh.CStruct(),
    "UpdateBlockNewOrders" / borsh.CStruct(),
    "UpdateBlockOrdersTaking" / borsh.CStruct(),
    "UpdateHostFeeBps" / borsh.CStruct(),
    "UpdateAdminAuthority" / borsh.CStruct(),
)
