from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class CheckPermissionAccounts(typing.TypedDict):
    sysvar_instructions: Pubkey
    permission: Pubkey
    router: Pubkey
    config_router: Pubkey
    express_relay_metadata: Pubkey


def check_permission(
    accounts: CheckPermissionAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(
            pubkey=accounts["sysvar_instructions"], is_signer=False, is_writable=False
        ),
        AccountMeta(pubkey=accounts["permission"], is_signer=False, is_writable=False),
        AccountMeta(pubkey=accounts["router"], is_signer=False, is_writable=False),
        AccountMeta(
            pubkey=accounts["config_router"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"],
            is_signer=False,
            is_writable=False,
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x9a\xc7\xe8\xf2`H\xc5\xec"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
