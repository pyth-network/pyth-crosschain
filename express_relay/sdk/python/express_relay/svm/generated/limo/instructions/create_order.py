from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from ..program_id import PROGRAM_ID


class CreateOrderArgs(typing.TypedDict):
    input_amount: int
    output_amount: int
    order_type: int


layout = borsh.CStruct(
    "input_amount" / borsh.U64, "output_amount" / borsh.U64, "order_type" / borsh.U8
)


class CreateOrderAccounts(typing.TypedDict):
    maker: Pubkey
    global_config: Pubkey
    pda_authority: Pubkey
    order: Pubkey
    input_mint: Pubkey
    output_mint: Pubkey
    maker_ata: Pubkey
    input_vault: Pubkey
    input_token_program: Pubkey
    output_token_program: Pubkey


def create_order(
    args: CreateOrderArgs,
    accounts: CreateOrderAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["maker"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["global_config"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["pda_authority"], is_signer=False, is_writable=False
        ),
        AccountMeta(pubkey=accounts["order"], is_signer=False, is_writable=True),
        AccountMeta(pubkey=accounts["input_mint"], is_signer=False, is_writable=False),
        AccountMeta(pubkey=accounts["output_mint"], is_signer=False, is_writable=False),
        AccountMeta(pubkey=accounts["maker_ata"], is_signer=False, is_writable=True),
        AccountMeta(pubkey=accounts["input_vault"], is_signer=False, is_writable=True),
        AccountMeta(
            pubkey=accounts["input_token_program"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["output_token_program"], is_signer=False, is_writable=False
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x8d6%\xcf\xed\xd2\xfa\xd7"
    encoded_args = layout.build(
        {
            "input_amount": args["input_amount"],
            "output_amount": args["output_amount"],
            "order_type": args["order_type"],
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
