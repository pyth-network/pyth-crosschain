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


class OrderJSON(typing.TypedDict):
    global_config: str
    maker: str
    input_mint: str
    input_mint_program_id: str
    output_mint: str
    output_mint_program_id: str
    initial_input_amount: int
    expected_output_amount: int
    remaining_input_amount: int
    filled_output_amount: int
    tip_amount: int
    number_of_fills: int
    order_type: int
    status: int
    in_vault_bump: int
    padding0: list[int]
    padding: list[int]


@dataclass
class Order:
    discriminator: typing.ClassVar = b"\x86\xad\xdf\xb9MV\x1c3"
    layout: typing.ClassVar = borsh.CStruct(
        "global_config" / BorshPubkey,
        "maker" / BorshPubkey,
        "input_mint" / BorshPubkey,
        "input_mint_program_id" / BorshPubkey,
        "output_mint" / BorshPubkey,
        "output_mint_program_id" / BorshPubkey,
        "initial_input_amount" / borsh.U64,
        "expected_output_amount" / borsh.U64,
        "remaining_input_amount" / borsh.U64,
        "filled_output_amount" / borsh.U64,
        "tip_amount" / borsh.U64,
        "number_of_fills" / borsh.U64,
        "order_type" / borsh.U8,
        "status" / borsh.U8,
        "in_vault_bump" / borsh.U8,
        "padding0" / borsh.U8[5],
        "padding" / borsh.U64[21],
    )
    global_config: Pubkey
    maker: Pubkey
    input_mint: Pubkey
    input_mint_program_id: Pubkey
    output_mint: Pubkey
    output_mint_program_id: Pubkey
    initial_input_amount: int
    expected_output_amount: int
    remaining_input_amount: int
    filled_output_amount: int
    tip_amount: int
    number_of_fills: int
    order_type: int
    status: int
    in_vault_bump: int
    padding0: list[int]
    padding: list[int]

    @classmethod
    async def fetch(
        cls,
        conn: AsyncClient,
        address: Pubkey,
        commitment: typing.Optional[Commitment] = None,
        program_id: Pubkey = PROGRAM_ID,
    ) -> typing.Optional["Order"]:
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
    ) -> typing.List[typing.Optional["Order"]]:
        infos = await get_multiple_accounts(conn, addresses, commitment=commitment)
        res: typing.List[typing.Optional["Order"]] = []
        for info in infos:
            if info is None:
                res.append(None)
                continue
            if info.account.owner != program_id:
                raise ValueError("Account does not belong to this program")
            res.append(cls.decode(info.account.data))
        return res

    @classmethod
    def decode(cls, data: bytes) -> "Order":
        if data[:ACCOUNT_DISCRIMINATOR_SIZE] != cls.discriminator:
            raise AccountInvalidDiscriminator(
                "The discriminator for this account is invalid"
            )
        dec = Order.layout.parse(data[ACCOUNT_DISCRIMINATOR_SIZE:])
        return cls(
            global_config=dec.global_config,
            maker=dec.maker,
            input_mint=dec.input_mint,
            input_mint_program_id=dec.input_mint_program_id,
            output_mint=dec.output_mint,
            output_mint_program_id=dec.output_mint_program_id,
            initial_input_amount=dec.initial_input_amount,
            expected_output_amount=dec.expected_output_amount,
            remaining_input_amount=dec.remaining_input_amount,
            filled_output_amount=dec.filled_output_amount,
            tip_amount=dec.tip_amount,
            number_of_fills=dec.number_of_fills,
            order_type=dec.order_type,
            status=dec.status,
            in_vault_bump=dec.in_vault_bump,
            padding0=dec.padding0,
            padding=dec.padding,
        )

    def to_json(self) -> OrderJSON:
        return {
            "global_config": str(self.global_config),
            "maker": str(self.maker),
            "input_mint": str(self.input_mint),
            "input_mint_program_id": str(self.input_mint_program_id),
            "output_mint": str(self.output_mint),
            "output_mint_program_id": str(self.output_mint_program_id),
            "initial_input_amount": self.initial_input_amount,
            "expected_output_amount": self.expected_output_amount,
            "remaining_input_amount": self.remaining_input_amount,
            "filled_output_amount": self.filled_output_amount,
            "tip_amount": self.tip_amount,
            "number_of_fills": self.number_of_fills,
            "order_type": self.order_type,
            "status": self.status,
            "in_vault_bump": self.in_vault_bump,
            "padding0": self.padding0,
            "padding": self.padding,
        }

    @classmethod
    def from_json(cls, obj: OrderJSON) -> "Order":
        return cls(
            global_config=Pubkey.from_string(obj["global_config"]),
            maker=Pubkey.from_string(obj["maker"]),
            input_mint=Pubkey.from_string(obj["input_mint"]),
            input_mint_program_id=Pubkey.from_string(obj["input_mint_program_id"]),
            output_mint=Pubkey.from_string(obj["output_mint"]),
            output_mint_program_id=Pubkey.from_string(obj["output_mint_program_id"]),
            initial_input_amount=obj["initial_input_amount"],
            expected_output_amount=obj["expected_output_amount"],
            remaining_input_amount=obj["remaining_input_amount"],
            filled_output_amount=obj["filled_output_amount"],
            tip_amount=obj["tip_amount"],
            number_of_fills=obj["number_of_fills"],
            order_type=obj["order_type"],
            status=obj["status"],
            in_vault_bump=obj["in_vault_bump"],
            padding0=obj["padding0"],
            padding=obj["padding"],
        )
