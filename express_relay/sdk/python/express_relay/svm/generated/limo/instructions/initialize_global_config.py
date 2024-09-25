from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class InitializeGlobalConfigAccounts(typing.TypedDict):
    admin_authority: Pubkey
    pda_authority: Pubkey
    global_config: Pubkey


def initialize_global_config(
    accounts: InitializeGlobalConfigAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(
            pubkey=accounts["admin_authority"], is_signer=True, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["pda_authority"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["global_config"], is_signer=False, is_writable=True
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"q\xd8z\x83\xe1\xd1\x167"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
