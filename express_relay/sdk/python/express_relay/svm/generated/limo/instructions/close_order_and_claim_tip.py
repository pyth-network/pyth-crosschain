from __future__ import annotations
import typing
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID
from solders.instruction import Instruction, AccountMeta
from ..program_id import PROGRAM_ID


class CloseOrderAndClaimTipAccounts(typing.TypedDict):
    maker: Pubkey
    order: Pubkey
    global_config: Pubkey
    pda_authority: Pubkey
    input_mint: Pubkey
    maker_input_ata: Pubkey
    input_vault: Pubkey
    input_token_program: Pubkey


def close_order_and_claim_tip(
    accounts: CloseOrderAndClaimTipAccounts,
    program_id: Pubkey = PROGRAM_ID,
    remaining_accounts: typing.Optional[typing.List[AccountMeta]] = None,
) -> Instruction:
    keys: list[AccountMeta] = [
        AccountMeta(pubkey=accounts["maker"], is_signer=True, is_writable=True),
        AccountMeta(pubkey=accounts["order"], is_signer=False, is_writable=True),
        AccountMeta(
            pubkey=accounts["global_config"], is_signer=False, is_writable=True
        ),
        AccountMeta(
            pubkey=accounts["pda_authority"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=accounts["input_mint"], is_signer=False, is_writable=False),
        AccountMeta(
            pubkey=accounts["maker_input_ata"], is_signer=False, is_writable=True
        ),
        AccountMeta(pubkey=accounts["input_vault"], is_signer=False, is_writable=True),
        AccountMeta(
            pubkey=accounts["input_token_program"], is_signer=False, is_writable=False
        ),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    if remaining_accounts is not None:
        keys += remaining_accounts
    identifier = b"\xf4\x1b\x0c\xe2-\xf7\xe6+"
    encoded_args = b""
    data = identifier + encoded_args
    return Instruction(program_id, data, keys)
