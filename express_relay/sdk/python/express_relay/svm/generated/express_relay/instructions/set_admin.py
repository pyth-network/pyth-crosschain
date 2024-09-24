from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class SetAdminAccounts(typing.TypedDict):
    admin: Pubkey
    express_relay_metadata: Pubkey
    admin_new: Pubkey


def set_admin(
    accounts: SetAdminAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["admin"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=accounts["admin_new"], is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xfb\xa3\x004[\xc2\xbb\\"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
