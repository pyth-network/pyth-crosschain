from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import PlainSerializer


class UnsupportedOpportunityVersionException(Exception):
    pass


class BidStatus(Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    LOST = "lost"
    WON = "won"


IntString = Annotated[int, PlainSerializer(lambda x: str(x), return_type=str)]
UUIDString = Annotated[UUID, PlainSerializer(lambda x: str(x), return_type=str)]
