from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class SetRelayerAccounts(typing.TypedDict):
    admin: Pubkey
    express_relay_metadata: Pubkey
    relayer_signer: Pubkey
    fee_receiver_relayer: Pubkey


def set_relayer(
    accounts: SetRelayerAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["admin"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["relayer_signer"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["fee_receiver_relayer"], is_signer=False, is_writable=False
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x17\xf3!XnT\xc4%"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
