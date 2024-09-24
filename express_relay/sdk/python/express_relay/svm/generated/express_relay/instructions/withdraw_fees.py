from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class WithdrawFeesAccounts(typing.TypedDict):
    admin: Pubkey
    fee_receiver_admin: Pubkey
    express_relay_metadata: Pubkey


def withdraw_fees(
    accounts: WithdrawFeesAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["admin"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["fee_receiver_admin"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xc6\xd4\xabm\x90\xd7\xaeY"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
