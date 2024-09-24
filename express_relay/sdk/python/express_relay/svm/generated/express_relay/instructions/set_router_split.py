from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from .. import types
from ..program_id import PROGRAM_ID


class SetRouterSplitArgs(typing.TypedDict):
    data: types.set_router_split_args.SetRouterSplitArgs


layout = borsh.CStruct("data" / types.set_router_split_args.SetRouterSplitArgs.layout)


class SetRouterSplitAccounts(typing.TypedDict):
    admin: Pubkey
    config_router: Pubkey
    express_relay_metadata: Pubkey
    router: Pubkey


def set_router_split(
    args: SetRouterSplitArgs,
    accounts: SetRouterSplitAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["admin"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["config_router"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"],
            is_signer=False,
            is_writable=False,
        ),
        AccountMeta(pubkey=accounts["router"], is_signer=False, is_writable=False),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x10\x96j\r\x1b\xbfh\x08"
    encoded_args = layout.build(
        {
            "data": args["data"].to_encodable(),
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
