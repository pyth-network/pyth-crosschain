from __future__ import annotations
import typing
from dataclasses import dataclass
from construct import Container
import borsh_construct as borsh


class SubmitBidArgsJSON(typing.TypedDict):
    deadline: int
    bid_amount: int


@dataclass
class SubmitBidArgs:
    layout: typing.ClassVar = borsh.CStruct(
        "deadline" / borsh.I64, "bid_amount" / borsh.U64
    )
    deadline: int
    bid_amount: int

    @classmethod
    def from_decoded(cls, obj: Container) -> "SubmitBidArgs":
        return cls(deadline=obj.deadline, bid_amount=obj.bid_amount)

    def to_encodable(self) -> dict[str, typing.Any]:
        return {"deadline": self.deadline, "bid_amount": self.bid_amount}

    def to_json(self) -> SubmitBidArgsJSON:
        return {"deadline": self.deadline, "bid_amount": self.bid_amount}

    @classmethod
    def from_json(cls, obj: SubmitBidArgsJSON) -> "SubmitBidArgs":
        return cls(deadline=obj["deadline"], bid_amount=obj["bid_amount"])
