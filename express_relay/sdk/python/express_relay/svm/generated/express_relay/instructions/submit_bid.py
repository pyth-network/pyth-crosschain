from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from .. import types
from ..program_id import PROGRAM_ID


class SubmitBidArgs(typing.TypedDict):
    data: types.submit_bid_args.SubmitBidArgs


layout = borsh.CStruct("data" / types.submit_bid_args.SubmitBidArgs.layout)


class SubmitBidAccounts(typing.TypedDict):
    searcher: Pubkey
    relayer_signer: Pubkey
    permission: Pubkey
    router: Pubkey
    config_router: Pubkey
    express_relay_metadata: Pubkey
    fee_receiver_relayer: Pubkey
    sysvar_instructions: Pubkey


def submit_bid(
    args: SubmitBidArgs,
    accounts: SubmitBidAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["searcher"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["relayer_signer"], is_signer=True, is_writable=False
        ),
        AccountMeta(pubkey=accounts["permission"], is_signer=False, is_writable=False),
        AccountMeta(pubkey=accounts["router"], is_signer=False, is_writable=True),
        AccountMeta(
            pubkey=accounts["config_router"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["fee_receiver_relayer"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(
            pubkey=accounts["sysvar_instructions"], is_signer=False, is_writable=False
        ),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\x13\xa4\xed\xfe@\x8b\xed]"
    encoded_args = layout.build(
        {
            "data": args["data"].to_encodable(),
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
