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


class GlobalConfigJSON(typing.TypedDict):
    emergency_mode: int
    local_admins_blocked: int
    new_orders_blocked: int
    orders_matching_blocked: int
    host_fee_bps: int
    padding0: list[int]
    padding1: list[int]
    pda_authority_previous_lamports_balance: int
    total_tip_amount: int
    host_tip_amount: int
    pda_authority: str
    pda_authority_bump: int
    admin_authority: str
    padding2: list[int]


@dataclass
class GlobalConfig:
    discriminator: typing.ClassVar = b"\x95\x08\x9c\xca\xa0\xfc\xb0\xd9"
    layout: typing.ClassVar = borsh.CStruct(
        "emergency_mode" / borsh.U8,
        "local_admins_blocked" / borsh.U8,
        "new_orders_blocked" / borsh.U8,
        "orders_matching_blocked" / borsh.U8,
        "host_fee_bps" / borsh.U16,
        "padding0" / borsh.U8[2],
        "padding1" / borsh.U64[10],
        "pda_authority_previous_lamports_balance" / borsh.U64,
        "total_tip_amount" / borsh.U64,
        "host_tip_amount" / borsh.U64,
        "pda_authority" / BorshPubkey,
        "pda_authority_bump" / borsh.U64,
        "admin_authority" / BorshPubkey,
        "padding2" / borsh.U64[247],
    )
    emergency_mode: int
    local_admins_blocked: int
    new_orders_blocked: int
    orders_matching_blocked: int
    host_fee_bps: int
    padding0: list[int]
    padding1: list[int]
    pda_authority_previous_lamports_balance: int
    total_tip_amount: int
    host_tip_amount: int
    pda_authority: Pubkey
    pda_authority_bump: int
    admin_authority: Pubkey
    padding2: list[int]

    @classmethod
    async def fetch(
        cls,
        conn: AsyncClient,
        address: Pubkey,
        commitment: typing.Optional[Commitment] = None,
        program_id: Pubkey = PROGRAM_ID,
    ) -> typing.Optional["GlobalConfig"]:
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
    ) -> typing.List[typing.Optional["GlobalConfig"]]:
        infos = await get_multiple_accounts(conn, addresses, commitment=commitment)
        res: typing.List[typing.Optional["GlobalConfig"]] = []
        for info in infos:
            if info is None:
                res.append(None)
                continue
            if info.account.owner != program_id:
                raise ValueError("Account does not belong to this program")
            res.append(cls.decode(info.account.data))
        return res

    @classmethod
    def decode(cls, data: bytes) -> "GlobalConfig":
        if data[:ACCOUNT_DISCRIMINATOR_SIZE] != cls.discriminator:
            raise AccountInvalidDiscriminator(
                "The discriminator for this account is invalid"
            )
        dec = GlobalConfig.layout.parse(data[ACCOUNT_DISCRIMINATOR_SIZE:])
        return cls(
            emergency_mode=dec.emergency_mode,
            local_admins_blocked=dec.local_admins_blocked,
            new_orders_blocked=dec.new_orders_blocked,
            orders_matching_blocked=dec.orders_matching_blocked,
            host_fee_bps=dec.host_fee_bps,
            padding0=dec.padding0,
            padding1=dec.padding1,
            pda_authority_previous_lamports_balance=dec.pda_authority_previous_lamports_balance,
            total_tip_amount=dec.total_tip_amount,
            host_tip_amount=dec.host_tip_amount,
            pda_authority=dec.pda_authority,
            pda_authority_bump=dec.pda_authority_bump,
            admin_authority=dec.admin_authority,
            padding2=dec.padding2,
        )

    def to_json(self) -> GlobalConfigJSON:
        return {
            "emergency_mode": self.emergency_mode,
            "local_admins_blocked": self.local_admins_blocked,
            "new_orders_blocked": self.new_orders_blocked,
            "orders_matching_blocked": self.orders_matching_blocked,
            "host_fee_bps": self.host_fee_bps,
            "padding0": self.padding0,
            "padding1": self.padding1,
            "pda_authority_previous_lamports_balance": self.pda_authority_previous_lamports_balance,
            "total_tip_amount": self.total_tip_amount,
            "host_tip_amount": self.host_tip_amount,
            "pda_authority": str(self.pda_authority),
            "pda_authority_bump": self.pda_authority_bump,
            "admin_authority": str(self.admin_authority),
            "padding2": self.padding2,
        }

    @classmethod
    def from_json(cls, obj: GlobalConfigJSON) -> "GlobalConfig":
        return cls(
            emergency_mode=obj["emergency_mode"],
            local_admins_blocked=obj["local_admins_blocked"],
            new_orders_blocked=obj["new_orders_blocked"],
            orders_matching_blocked=obj["orders_matching_blocked"],
            host_fee_bps=obj["host_fee_bps"],
            padding0=obj["padding0"],
            padding1=obj["padding1"],
            pda_authority_previous_lamports_balance=obj[
                "pda_authority_previous_lamports_balance"
            ],
            total_tip_amount=obj["total_tip_amount"],
            host_tip_amount=obj["host_tip_amount"],
            pda_authority=Pubkey.from_string(obj["pda_authority"]),
            pda_authority_bump=obj["pda_authority_bump"],
            admin_authority=Pubkey.from_string(obj["admin_authority"]),
            padding2=obj["padding2"],
        )
