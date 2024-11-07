from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
import borsh_construct as borsh
from .. import types
from ..program_id import PROGRAM_ID


class InitializeArgs(typing.TypedDict):
    data: types.initialize_args.InitializeArgs


layout = borsh.CStruct("data" / types.initialize_args.InitializeArgs.layout)


class InitializeAccounts(typing.TypedDict):
    payer: Pubkey
    express_relay_metadata: Pubkey
    admin: Pubkey
    relayer_signer: Pubkey
    fee_receiver_relayer: Pubkey


def initialize(
    args: InitializeArgs,
    accounts: InitializeAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["payer"], is_signer=True, is_writable=True),
        AccountMeta(
            pubkey=accounts["express_relay_metadata"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=accounts["admin"], is_signer=False, is_writable=False),
        AccountMeta(
            pubkey=accounts["relayer_signer"], is_signer=False, is_writable=False
        ),
        AccountMeta(
            pubkey=accounts["fee_receiver_relayer"], is_signer=False, is_writable=False
        ),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xaf\xafm\x1f\r\x98\x9b\xed"
    encoded_args = layout.build(
        {
            "data": args["data"].to_encodable(),
        }
    )
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
