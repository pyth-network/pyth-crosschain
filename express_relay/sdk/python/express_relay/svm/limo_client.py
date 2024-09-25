from decimal import Decimal
from typing import Sequence, List, TypedDict, Tuple

from solana.constants import SYSTEM_PROGRAM_ID
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import MemcmpOpts
from solders import system_program
from solders.instruction import Instruction, AccountMeta
from solders.pubkey import Pubkey
from solders.system_program import TransferParams
from solders.sysvar import RENT, INSTRUCTIONS
from spl.token._layouts import MINT_LAYOUT, ACCOUNT_LAYOUT as TOKEN_ACCOUNT_LAYOUT
from spl.token.constants import (
    WRAPPED_SOL_MINT,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
)

from express_relay.svm.generated.limo.accounts import Order
from express_relay.svm.generated.limo.instructions import (
    take_order,
    TakeOrderArgs,
)
from express_relay.svm.generated.limo.program_id import PROGRAM_ID

import spl.token.instructions as spl_token

ESCROW_VAULT_SEED = b"escrow_vault"
GLOBAL_AUTH_SEED = b"authority"
EXPRESS_RELAY_MEATADATA_SEED = b"metadata"
EXPRESS_RELAY_CONFIG_ROUTER_SEED = b"config_router"


class OrderStateAndAddress(TypedDict):
    state: Order
    address: Pubkey


class WSOLInstructions(TypedDict):
    create_ixs: List[Instruction]
    fill_ixs: List[Instruction]
    close_ixs: List[Instruction]
    ata: Pubkey


class LimoClient:
    def __init__(self, connection: AsyncClient, global_config: Pubkey):
        self._connection = connection
        self._global_config = global_config

    async def get_all_orders_state_and_address_with_filters(
        self, filters: List[MemcmpOpts]
    ) -> List[OrderStateAndAddress]:
        filters.append(MemcmpOpts(offset=8, bytes=str(self._global_config)))
        programs = await self._connection.get_program_accounts(
            PROGRAM_ID,
            commitment=None,
            encoding="base64",
            data_slice=None,
            filters=filters,
        )

        return [
            {"state": Order.decode(value.account.data), "address": value.pubkey}
            for value in programs.value
        ]

    async def get_mint_decimals(self, mint: Pubkey) -> int:
        mint_account = await self._connection.get_account_info(mint)
        if mint_account.value is None:
            raise ValueError("Mint account not found")
        bytes_data = mint_account.value.data
        if len(bytes_data) != MINT_LAYOUT.sizeof():
            raise ValueError("Invalid mint size")

        decoded_data = MINT_LAYOUT.parse(bytes_data)
        decimals = decoded_data.decimals
        return decimals

    async def account_exists(self, address: Pubkey) -> bool:
        account_info = await self._connection.get_account_info(address)
        return account_info.value is not None

    def create_associated_token_account_idempotent(
        self, payer: Pubkey, owner: Pubkey, mint: Pubkey, token_program_id: Pubkey
    ) -> Instruction:
        """Creates a transaction instruction to create an associated token account.

        Returns:
            The instruction to create the associated token account.
        """
        associated_token_address = self.get_ata(owner, mint, token_program_id)
        return Instruction(
            accounts=[
                AccountMeta(pubkey=payer, is_signer=True, is_writable=True),
                AccountMeta(
                    pubkey=associated_token_address, is_signer=False, is_writable=True
                ),
                AccountMeta(pubkey=owner, is_signer=False, is_writable=False),
                AccountMeta(pubkey=mint, is_signer=False, is_writable=False),
                AccountMeta(
                    pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False
                ),
                AccountMeta(
                    pubkey=token_program_id, is_signer=False, is_writable=False
                ),
                AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
            ],
            program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
            data=bytes(1),  # idempotent version of the instruction
        )

    async def get_ata_and_create_ixn_if_required(
        self,
        owner: Pubkey,
        token_mint_address: Pubkey,
        token_program_id: Pubkey,
        payer: Pubkey,
    ) -> Tuple[Pubkey, Sequence[Instruction]]:
        ata = self.get_ata(owner, token_mint_address, token_program_id)
        if not await self.account_exists(ata):
            ix = self.create_associated_token_account_idempotent(
                payer, owner, token_mint_address, token_program_id
            )
            return ata, [ix]
        return ata, []

    async def get_init_if_needed_wsol_create_and_close_ixs(
        self, owner: Pubkey, payer: Pubkey, amount_to_deposit_lamports: int
    ) -> WSOLInstructions:
        """
        Returns necessary instructions to create, fill and close a wrapped SOL account.
        If the account already exists:
            it makes sure the balance is at least `amount_to_deposit_lamports` with no create or close instructions.
        If the account does not exist:
            it creates the account, fills it with `amount_to_deposit_lamports` lamports and close it in the end.
        Args:
            owner: Who owns the WSOL token account
            payer: Who pays for the instructions
            amount_to_deposit_lamports: Minimum amount of lamports required in the account
        """
        ata = self.get_ata(owner, WRAPPED_SOL_MINT, TOKEN_PROGRAM_ID)
        ata_info = await self._connection.get_account_info(ata)

        create_ixs = []
        close_ixs = []
        if ata_info.value is None:
            create_ixs = [
                self.create_associated_token_account_idempotent(
                    payer, owner, WRAPPED_SOL_MINT, TOKEN_PROGRAM_ID
                )
            ]
            close_ixs = [
                spl_token.close_account(
                    spl_token.CloseAccountParams(
                        program_id=TOKEN_PROGRAM_ID,
                        account=ata,
                        dest=owner,
                        owner=owner,
                    )
                )
            ]

        fill_ixs = []
        current_balance = (
            TOKEN_ACCOUNT_LAYOUT.parse(ata_info.value.data).amount
            if ata_info.value
            else 0
        )
        if current_balance < amount_to_deposit_lamports:
            fill_ixs = [
                system_program.transfer(
                    TransferParams(
                        from_pubkey=owner,
                        to_pubkey=ata,
                        lamports=amount_to_deposit_lamports - current_balance,
                    )
                ),
                spl_token.sync_native(
                    spl_token.SyncNativeParams(TOKEN_PROGRAM_ID, ata)
                ),
            ]

        return WSOLInstructions(
            create_ixs=create_ixs, fill_ixs=fill_ixs, close_ixs=close_ixs, ata=ata
        )

    async def take_order_ix(
        self,
        taker: Pubkey,
        order: OrderStateAndAddress,
        input_amount_decimals: Decimal,
        input_mint_decimals: int,
        express_relay_program_id: Pubkey,
    ) -> List[Instruction]:
        """
        Returns the instructions to fulfill an order as a taker.
        Args:
            taker: The taker's public key
            order: The order to fulfill
            input_amount_decimals: The amount of input tokens to take multiplied by 10 ** input_mint_decimals
            input_mint_decimals: input mint decimals (can be fetched via get_mint_decimals)
            express_relay_program_id: Express relay program id

        Returns:
            A list of instructions to include in the transaction to fulfill the order. The submit_bid instruction for
            express relay program is not included and should be added separately.

        """
        ixs: List[Instruction] = []
        close_wsol_ixns: List[Instruction] = []
        taker_input_ata: Pubkey
        if order["state"].input_mint == WRAPPED_SOL_MINT:
            instructions = await self.get_init_if_needed_wsol_create_and_close_ixs(
                owner=taker, payer=taker, amount_to_deposit_lamports=0
            )
            ixs.extend(instructions["create_ixs"])
            close_wsol_ixns.extend(instructions["close_ixs"])
            taker_input_ata = instructions["ata"]
        else:
            (
                taker_input_ata,
                create_taker_input_ata_ixs,
            ) = await self.get_ata_and_create_ixn_if_required(
                owner=taker,
                token_mint_address=order["state"].input_mint,
                token_program_id=order["state"].input_mint_program_id,
                payer=taker,
            )
            ixs.extend(create_taker_input_ata_ixs)

        taker_output_ata: Pubkey
        if order["state"].output_mint == WRAPPED_SOL_MINT:
            raise NotImplementedError("Output mint is WSOL")
        else:
            (
                taker_output_ata,
                create_taker_output_ata_ixs,
            ) = await self.get_ata_and_create_ixn_if_required(
                owner=taker,
                token_mint_address=order["state"].output_mint,
                token_program_id=order["state"].output_mint_program_id,
                payer=taker,
            )
            ixs.extend(create_taker_output_ata_ixs)

        (
            maker_output_ata,
            create_maker_output_ata_ixs,
        ) = await self.get_ata_and_create_ixn_if_required(
            owner=order["state"].maker,
            token_mint_address=order["state"].output_mint,
            token_program_id=order["state"].output_mint_program_id,
            payer=taker,
        )
        ixs.extend(create_maker_output_ata_ixs)

        pda_authority = self.get_pda_authority(PROGRAM_ID, order["state"].global_config)
        ixs.append(
            take_order(
                TakeOrderArgs(
                    input_amount=int(
                        input_amount_decimals * (10**input_mint_decimals)
                    )
                ),
                {
                    "taker": taker,
                    "maker": order["state"].maker,
                    "global_config": order["state"].global_config,
                    "pda_authority": pda_authority,
                    "order": order["address"],
                    "input_mint": order["state"].input_mint,
                    "output_mint": order["state"].output_mint,
                    "input_vault": self.get_token_vault_pda(
                        PROGRAM_ID,
                        order["state"].global_config,
                        order["state"].input_mint,
                    ),
                    "taker_input_ata": taker_input_ata,
                    "taker_output_ata": taker_output_ata,
                    "maker_output_ata": maker_output_ata,
                    "express_relay": express_relay_program_id,
                    "express_relay_metadata": self.get_express_relay_metadata_pda(
                        express_relay_program_id
                    ),
                    "sysvar_instructions": INSTRUCTIONS,
                    "permission": order["address"],
                    "config_router": self.get_express_relay_config_router_pda(
                        express_relay_program_id, pda_authority
                    ),
                    "input_token_program": order["state"].input_mint_program_id,
                    "output_token_program": order["state"].output_mint_program_id,
                },
            )
        )

        ixs.extend(close_wsol_ixns)
        return ixs

    @staticmethod
    def get_program_id() -> Pubkey:
        return PROGRAM_ID

    @staticmethod
    def get_token_vault_pda(
        program_id: Pubkey, global_config: Pubkey, input_mint: Pubkey
    ) -> Pubkey:
        return Pubkey.find_program_address(
            seeds=[ESCROW_VAULT_SEED, bytes(global_config), bytes(input_mint)],
            program_id=program_id,
        )[0]

    @staticmethod
    def get_express_relay_metadata_pda(program_id: Pubkey) -> Pubkey:
        return Pubkey.find_program_address(
            seeds=[EXPRESS_RELAY_MEATADATA_SEED], program_id=program_id
        )[0]

    @staticmethod
    def get_express_relay_config_router_pda(
        program_id: Pubkey, router: Pubkey
    ) -> Pubkey:
        return Pubkey.find_program_address(
            seeds=[EXPRESS_RELAY_CONFIG_ROUTER_SEED, bytes(router)],
            program_id=program_id,
        )[0]

    @staticmethod
    def get_pda_authority(program_id: Pubkey, global_config: Pubkey) -> Pubkey:
        return Pubkey.find_program_address(
            seeds=[GLOBAL_AUTH_SEED, bytes(global_config)], program_id=program_id
        )[0]

    @staticmethod
    def get_ata(
        owner: Pubkey, token_mint_address: Pubkey, token_program_id: Pubkey
    ) -> Pubkey:
        ata, _ = Pubkey.find_program_address(
            seeds=[bytes(owner), bytes(token_program_id), bytes(token_mint_address)],
            program_id=ASSOCIATED_TOKEN_PROGRAM_ID,
        )
        return ata
