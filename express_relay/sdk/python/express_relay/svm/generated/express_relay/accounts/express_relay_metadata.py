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


class ExpressRelayMetadataJSON(typing.TypedDict):
    admin: str
    relayer_signer: str
    fee_receiver_relayer: str
    split_router_default: int
    split_relayer: int


@dataclass
class ExpressRelayMetadata:
    discriminator: typing.ClassVar = b"\xccK\x85\x07\xaf\xf1\x82\x0b"
    layout: typing.ClassVar = borsh.CStruct(
        "admin" / BorshPubkey,
        "relayer_signer" / BorshPubkey,
        "fee_receiver_relayer" / BorshPubkey,
        "split_router_default" / borsh.U64,
        "split_relayer" / borsh.U64,
    )
    admin: Pubkey
    relayer_signer: Pubkey
    fee_receiver_relayer: Pubkey
    split_router_default: int
    split_relayer: int

    @classmethod
    async def fetch(
        cls,
        conn: AsyncClient,
        address: Pubkey,
        commitment: typing.Optional[Commitment] = None,
        program_id: Pubkey = PROGRAM_ID,
    ) -> typing.Optional["ExpressRelayMetadata"]:
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
    ) -> typing.List[typing.Optional["ExpressRelayMetadata"]]:
        infos = await get_multiple_accounts(conn, addresses, commitment=commitment)
        res: typing.List[typing.Optional["ExpressRelayMetadata"]] = []
        for info in infos:
            if info is None:
                res.append(None)
                continue
            if info.account.owner != program_id:
                raise ValueError("Account does not belong to this program")
            res.append(cls.decode(info.account.data))
        return res

    @classmethod
    def decode(cls, data: bytes) -> "ExpressRelayMetadata":
        if data[:ACCOUNT_DISCRIMINATOR_SIZE] != cls.discriminator:
            raise AccountInvalidDiscriminator(
                "The discriminator for this account is invalid"
            )
        dec = ExpressRelayMetadata.layout.parse(data[ACCOUNT_DISCRIMINATOR_SIZE:])
        return cls(
            admin=dec.admin,
            relayer_signer=dec.relayer_signer,
            fee_receiver_relayer=dec.fee_receiver_relayer,
            split_router_default=dec.split_router_default,
            split_relayer=dec.split_relayer,
        )

    def to_json(self) -> ExpressRelayMetadataJSON:
        return {
            "admin": str(self.admin),
            "relayer_signer": str(self.relayer_signer),
            "fee_receiver_relayer": str(self.fee_receiver_relayer),
            "split_router_default": self.split_router_default,
            "split_relayer": self.split_relayer,
        }

    @classmethod
    def from_json(cls, obj: ExpressRelayMetadataJSON) -> "ExpressRelayMetadata":
        return cls(
            admin=Pubkey.from_string(obj["admin"]),
            relayer_signer=Pubkey.from_string(obj["relayer_signer"]),
            fee_receiver_relayer=Pubkey.from_string(obj["fee_receiver_relayer"]),
            split_router_default=obj["split_router_default"],
            split_relayer=obj["split_relayer"],
        )
