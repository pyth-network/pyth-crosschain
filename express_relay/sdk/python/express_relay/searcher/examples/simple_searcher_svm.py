import argparse
import asyncio
import logging
import typing
from decimal import Decimal

from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Finalized
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction

from express_relay.client import (
    ExpressRelayClient,
)
from express_relay.constants import SVM_CONFIGS
from express_relay.express_relay_types import (
    BidStatus,
    BidStatusUpdate,
    BidSvm,
    Opportunity,
)
from express_relay.express_relay_svm_types import OpportunitySvm
from express_relay.svm.generated.express_relay.accounts import ExpressRelayMetadata
from express_relay.svm.generated.express_relay.program_id import (
    PROGRAM_ID as SVM_EXPRESS_RELAY_PROGRAM_ID,
)
from express_relay.svm.limo_client import LimoClient, OrderStateAndAddress

DEADLINE = 2**62
logger = logging.getLogger(__name__)


class SimpleSearcherSvm:
    express_relay_metadata: ExpressRelayMetadata | None

    def __init__(
        self,
        server_url: str,
        private_key: Keypair,
        bid_amount: int,
        chain_id: str,
        svm_rpc_endpoint: str,
        limo_global_config: str,
        fill_rate: int,
        api_key: str | None = None,
    ):
        self.client = ExpressRelayClient(
            server_url,
            api_key,
            self.opportunity_callback,
            self.bid_status_callback,
        )
        self.private_key = private_key
        self.bid_amount = bid_amount
        self.chain_id = chain_id
        if self.chain_id not in SVM_CONFIGS:
            raise ValueError(f"Chain ID {self.chain_id} not supported")
        self.svm_config = SVM_CONFIGS[self.chain_id]
        self.rpc_client = AsyncClient(svm_rpc_endpoint)
        self.limo_client = LimoClient(
            self.rpc_client, global_config=Pubkey.from_string(limo_global_config)
        )
        self.fill_rate = fill_rate
        self.express_relay_metadata = None

    async def opportunity_callback(self, opp: Opportunity):
        """
        Callback function to run when a new opportunity is found.

        Args:
            opp: An object representing a single opportunity.
        """
        bid = await self.assess_opportunity(typing.cast(OpportunitySvm, opp))

        if bid:
            try:
                await self.client.submit_bid(bid)
                logger.info(f"Submitted bid for opportunity {str(opp.opportunity_id)}")
            except Exception as e:
                logger.error(
                    f"Error submitting bid for opportunity {str(opp.opportunity_id)}: {e}"
                )

    async def bid_status_callback(self, bid_status_update: BidStatusUpdate):
        """
        Callback function to run when a bid status is updated.

        Args:
            bid_status_update: An object representing an update to the status of a bid.
        """
        id = bid_status_update.id
        bid_status = bid_status_update.bid_status
        result = bid_status_update.result

        result_details = ""
        if bid_status == BidStatus("submitted") or bid_status == BidStatus("won"):
            result_details = f", transaction {result}"
        elif bid_status == BidStatus("lost"):
            if result:
                result_details = f", transaction {result}"
        logger.info(f"Bid status for bid {id}: {bid_status.value}{result_details}")

    async def assess_opportunity(self, opp: OpportunitySvm) -> BidSvm:
        order: OrderStateAndAddress = {"address": opp.order_address, "state": opp.order}
        input_mint_decimals = await self.limo_client.get_mint_decimals(
            order["state"].input_mint
        )
        output_mint_decimals = await self.limo_client.get_mint_decimals(
            order["state"].output_mint
        )
        input_amount_decimals = Decimal(
            order["state"].remaining_input_amount
        ) / Decimal(10**input_mint_decimals)
        input_amount_decimals = (
            input_amount_decimals * Decimal(self.fill_rate) / Decimal(100)
        )
        output_amount_decimals = Decimal(
            order["state"].expected_output_amount
        ) / Decimal(10**output_mint_decimals)
        logger.info(
            f"Order address {order['address']}\n"
            f"Sell token {order['state'].input_mint} amount: {input_amount_decimals}\n"
            f"Buy token {order['state'].output_mint} amount: {output_amount_decimals}"
        )
        ixs_take_order = await self.limo_client.take_order_ix(
            self.private_key.pubkey(),
            order,
            input_amount_decimals,
            input_mint_decimals,
            self.svm_config["express_relay_program"],
        )
        router = self.limo_client.get_pda_authority(
            self.limo_client.get_program_id(), order["state"].global_config
        )

        if self.express_relay_metadata is None:
            self.express_relay_metadata = await ExpressRelayMetadata.fetch(
                self.rpc_client,
                self.limo_client.get_express_relay_metadata_pda(
                    SVM_EXPRESS_RELAY_PROGRAM_ID
                ),
                commitment=Finalized,
            )
            if self.express_relay_metadata is None:
                raise ValueError("Express relay metadata account not found")

        submit_bid_ix = self.client.get_svm_submit_bid_instruction(
            searcher=self.private_key.pubkey(),
            router=router,
            permission_key=order["address"],
            bid_amount=self.bid_amount,
            deadline=DEADLINE,
            chain_id=self.chain_id,
            fee_receiver_relayer=self.express_relay_metadata.fee_receiver_relayer,
            relayer_signer=self.express_relay_metadata.relayer_signer,
        )
        transaction = Transaction.new_with_payer(
            [submit_bid_ix] + ixs_take_order, self.private_key.pubkey()
        )

        blockhash = (await self.rpc_client.get_latest_blockhash()).value
        transaction.partial_sign(
            [self.private_key], recent_blockhash=blockhash.blockhash
        )
        bid = BidSvm(transaction=transaction, chain_id=self.chain_id)
        return bid


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-v", "--verbose", action="count", default=0)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--private-key",
        type=str,
        help="Private key of the searcher in base58 format",
    )
    group.add_argument(
        "--private-key-json-file",
        type=str,
        help="Path to a json file containing the private key of the searcher in array of bytes format",
    )
    parser.add_argument(
        "--chain-id",
        type=str,
        required=True,
        help="Chain ID of the SVM network to submit bids",
    )
    parser.add_argument(
        "--endpoint-express-relay",
        type=str,
        required=True,
        help="Server endpoint to use for submitting bids",
    )
    parser.add_argument(
        "--endpoint-svm",
        type=str,
        required=True,
        help="Server endpoint to use for submitting bids",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        required=False,
        help="The API key of the searcher to authenticate with the server for fetching and submitting bids",
    )
    parser.add_argument(
        "--global-config",
        type=str,
        required=True,
        help="Limo program global config to use",
    )
    parser.add_argument(
        "--bid",
        type=int,
        default=100,
        required=True,
        help="The amount of bid to submit for each opportunity",
    )
    parser.add_argument(
        "--fill-rate",
        type=int,
        default=100,
        required=True,
        help="How much of the order to fill in percentage. Default is 100%",
    )

    args = parser.parse_args()

    logger.setLevel(logging.INFO if args.verbose == 0 else logging.DEBUG)
    log_handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s:%(name)s:%(module)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)

    if args.private_key:
        searcher_keypair = Keypair.from_base58_string(args.private_key)
    else:
        with open(args.private_key_json_file, "r") as f:
            searcher_keypair = Keypair.from_json(f.read())

    print("Using Keypair with pubkey:", searcher_keypair.pubkey())
    searcher = SimpleSearcherSvm(
        args.endpoint_express_relay,
        searcher_keypair,
        args.bid,
        args.chain_id,
        args.endpoint_svm,
        args.global_config,
        args.fill_rate,
        args.api_key,
    )

    await searcher.client.subscribe_chains([args.chain_id])

    task = await searcher.client.get_ws_loop()
    await task


if __name__ == "__main__":
    asyncio.run(main())
