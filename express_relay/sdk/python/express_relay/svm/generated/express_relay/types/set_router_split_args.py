from __future__ import annotations
import typing
from dataclasses import dataclass
from construct import Container
import borsh_construct as borsh


class SetRouterSplitArgsJSON(typing.TypedDict):
    split_router: int


@dataclass
class SetRouterSplitArgs:
    layout: typing.ClassVar = borsh.CStruct("split_router" / borsh.U64)
    split_router: int

    @classmethod
    def from_decoded(cls, obj: Container) -> "SetRouterSplitArgs":
        return cls(split_router=obj.split_router)

    def to_encodable(self) -> dict[str, typing.Any]:
        return {"split_router": self.split_router}

    def to_json(self) -> SetRouterSplitArgsJSON:
        return {"split_router": self.split_router}

    @classmethod
    def from_json(cls, obj: SetRouterSplitArgsJSON) -> "SetRouterSplitArgs":
        return cls(split_router=obj["split_router"])
