from __future__ import annotations
import typing
from dataclasses import dataclass
from construct import Container
import borsh_construct as borsh


class InitializeArgsJSON(typing.TypedDict):
    split_router_default: int
    split_relayer: int


@dataclass
class InitializeArgs:
    layout: typing.ClassVar = borsh.CStruct(
        "split_router_default" / borsh.U64, "split_relayer" / borsh.U64
    )
    split_router_default: int
    split_relayer: int

    @classmethod
    def from_decoded(cls, obj: Container) -> "InitializeArgs":
        return cls(
            split_router_default=obj.split_router_default,
            split_relayer=obj.split_relayer,
        )

    def to_encodable(self) -> dict[str, typing.Any]:
        return {
            "split_router_default": self.split_router_default,
            "split_relayer": self.split_relayer,
        }

    def to_json(self) -> InitializeArgsJSON:
        return {
            "split_router_default": self.split_router_default,
            "split_relayer": self.split_relayer,
        }

    @classmethod
    def from_json(cls, obj: InitializeArgsJSON) -> "InitializeArgs":
        return cls(
            split_router_default=obj["split_router_default"],
            split_relayer=obj["split_relayer"],
        )
