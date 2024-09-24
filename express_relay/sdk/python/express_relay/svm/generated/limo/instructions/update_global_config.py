from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from ..program_id import PROGRAM_ID


class UpdateGlobalConfigArgs(typing.TypedDict):
    mode: int
    value: list[int]


layout = borsh.CStruct("mode" / borsh.U16, "value" / borsh.U8[128])


class UpdateGlobalConfigAccounts(typing.TypedDict):
    admin_authority: Pubkey
    global_config: Pubkey


def update_global_config(
    args: UpdateGlobalConfigArgs,
    accounts: UpdateGlobalConfigAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(
            pubkey=accounts["admin_authority"], is_signer=True, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["global_config"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xa4T\x82\xbdo:\xfa\xc8"
    encoded_args = layout.build(
        {
            "mode": args["mode"],
            "value": args["value"],
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
