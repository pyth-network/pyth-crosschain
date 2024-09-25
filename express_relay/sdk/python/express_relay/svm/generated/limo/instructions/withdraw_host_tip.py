from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class WithdrawHostTipAccounts(typing.TypedDict):
    admin_authority: Pubkey
    global_config: Pubkey
    pda_authority: Pubkey


def withdraw_host_tip(
    accounts: WithdrawHostTipAccounts,
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
        AccountMeta(
            pubkey=accounts["pda_authority"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x8c\xf6i\xa5PU\x8f\x12"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
