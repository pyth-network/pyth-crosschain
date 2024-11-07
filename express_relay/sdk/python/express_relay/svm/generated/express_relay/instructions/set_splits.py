from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from .. import types
from ..program_id import PROGRAM_ID


class SetSplitsArgs(typing.TypedDict):
    data: types.set_splits_args.SetSplitsArgs


layout = borsh.CStruct("data" / types.set_splits_args.SetSplitsArgs.layout)


class SetSplitsAccounts(typing.TypedDict):
    admin: Pubkey
    express_relay_metadata: Pubkey


def set_splits(
    args: SetSplitsArgs,
    accounts: SetSplitsAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["admin"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xaf\x02V1\xe1\xca\xe8\xbd"
    encoded_args = layout.build(
        {
            "data": args["data"].to_encodable(),
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
