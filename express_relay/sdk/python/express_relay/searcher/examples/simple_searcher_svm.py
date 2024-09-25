import argparse
import asyncio
import logging
from decimal import Decimal

from solana.rpc.async_api import AsyncClient
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
)
from express_relay.svm.limo_client import LimoClient, OrderStateAndAddress

DEADLINE = 2**62
logger = logging.getLogger(__name__)


class SimpleSearcherSvm:
    def __init__(
        self,
        server_url: str,
        private_key: Keypair,
        bid_amount: int,
        chain_id: str,
        svm_rpc_endpoint: str,
        limo_global_config: str,
        api_key: str | None = None,
    ):
        self.client = ExpressRelayClient(
            server_url,
            api_key,
            None,
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

    async def bid_on_new_orders(self):
        orders = await self.limo_client.get_all_orders_state_and_address_with_filters(
            []
        )
        orders = [
            order for order in orders if order["state"].remaining_input_amount > 0
        ]
        if len(orders) == 0:
            logger.info("No orders to bid on")
            return
        for order in orders:
            await self.evaluate_order(order)

    async def evaluate_order(self, order: OrderStateAndAddress):
        input_mint_decimals = await self.limo_client.get_mint_decimals(
            order["state"].input_mint
        )
        output_mint_decimals = await self.limo_client.get_mint_decimals(
            order["state"].output_mint
        )
        input_amount_decimals = Decimal(
            order["state"].remaining_input_amount
        ) / Decimal(10**input_mint_decimals)
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
        submit_bid_ix = self.client.get_svm_submit_bid_instruction(
            searcher=self.private_key.pubkey(),
            router=router,
            permission_key=order["address"],
            bid_amount=self.bid_amount,
            deadline=DEADLINE,
            chain_id=self.chain_id,
        )
        transaction = Transaction.new_with_payer(
            [submit_bid_ix] + ixs_take_order, self.private_key.pubkey()
        )

        blockhash = (await self.rpc_client.get_latest_blockhash()).value
        transaction.partial_sign(
            [self.private_key], recent_blockhash=blockhash.blockhash
        )
        bid = BidSvm(transaction=transaction, chain_id=self.chain_id)
        bid_id = await self.client.submit_bid(bid, False)
        print(f"Submitted bid {bid_id} for order {order['address']}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-v", "--verbose", action="count", default=0)
    parser.add_argument(
        "--private-key",
        type=str,
        required=True,
        help="Private key of the searcher in base58 format",
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
    args = parser.parse_args()

    logger.setLevel(logging.INFO if args.verbose == 0 else logging.DEBUG)
    log_handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s:%(name)s:%(module)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)

    searcher = SimpleSearcherSvm(
        args.endpoint_express_relay,
        Keypair.from_base58_string(args.private_key),
        args.bid,
        args.chain_id,
        args.endpoint_svm,
        args.global_config,
        args.api_key,
    )

    await searcher.bid_on_new_orders()


if __name__ == "__main__":
    asyncio.run(main())
