import typing
from dataclasses import dataclass
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
import borsh_construct as borsh
from anchorpy.coder.accounts import ACCOUNT_DISCRIMINATOR_SIZE
from anchorpy.error import AccountInvalidDiscriminator
from anchorpy.utils.rpc import get_multiple_accounts
from anchorpy.borsh_extension import BorshPubkey
from ..program_id import PROGRAM_ID


class ConfigRouterJSON(typing.TypedDict):
    router: str
    split: int


@dataclass
class ConfigRouter:
    discriminator: typing.ClassVar = b"\x87B\xf0\xa6^\xc6\xbb$"
    layout: typing.ClassVar = borsh.CStruct("router" / BorshPubkey, "split" / borsh.U64)
    router: Pubkey
    split: int

    @classmethod
    async def fetch(
        cls,
        conn: AsyncClient,
        address: Pubkey,
        commitment: typing.Optional[Commitment] = None,
        program_id: Pubkey = PROGRAM_ID,
    ) -> typing.Optional["ConfigRouter"]:
        resp = await conn.get_account_info(address, commitment=commitment)
        info = resp.value
        if info is None:
            return None
        if info.owner != program_id:
            raise ValueError("Account does not belong to this program")
        bytes_data = info.data
        return cls.decode(bytes_data)

    @classmethod
    async def fetch_multiple(
        cls,
        conn: AsyncClient,
        addresses: list[Pubkey],
        commitment: typing.Optional[Commitment] = None,
        program_id: Pubkey = PROGRAM_ID,
    ) -> typing.List[typing.Optional["ConfigRouter"]]:
        infos = await get_multiple_accounts(conn, addresses, commitment=commitment)
        res: typing.List[typing.Optional["ConfigRouter"]] = []
        for info in infos:
            if info is None:
                res.append(None)
                continue
            if info.account.owner != program_id:
                raise ValueError("Account does not belong to this program")
            res.append(cls.decode(info.account.data))
        return res

    @classmethod
    def decode(cls, data: bytes) -> "ConfigRouter":
        if data[:ACCOUNT_DISCRIMINATOR_SIZE] != cls.discriminator:
            raise AccountInvalidDiscriminator(
                "The discriminator for this account is invalid"
            )
        dec = ConfigRouter.layout.parse(data[ACCOUNT_DISCRIMINATOR_SIZE:])
        return cls(
            router=dec.router,
            split=dec.split,
        )

    def to_json(self) -> ConfigRouterJSON:
        return {
            "router": str(self.router),
            "split": self.split,
        }

    @classmethod
    def from_json(cls, obj: ConfigRouterJSON) -> "ConfigRouter":
        return cls(
            router=Pubkey.from_string(obj["router"]),
            split=obj["split"],
        )
