import argparse
import asyncio
import logging
from eth_account.account import Account
from secrets import randbits

from express_relay.client import ExpressRelayClient, sign_bid
from express_relay.express_relay_types import (
    Opportunity,
    OpportunityBid,
    OpportunityBidParams,
    OpportunityAdapterConfig,
    Bytes32,
    BidStatus,
    BidStatusUpdate,
)

logger = logging.getLogger(__name__)

NAIVE_BID = int(2e16)
# Set deadline (naively) to max uint256
DEADLINE_MAX = 2**256 - 1


class SimpleSearcher:
    def __init__(
        self, server_url: str, private_key: Bytes32, api_key: str | None = None
    ):
        self.client = ExpressRelayClient(
            server_url,
            api_key,
            self.opportunity_callback,
            self.bid_status_callback,
        )
        self.opportunity_adapter_configs: dict[str, OpportunityAdapterConfig] = {}
        self.private_key = private_key
        self.public_key = Account.from_key(private_key).address

    async def query_opportunity_adapter_config(self, chain_id: str):
        """
        Gets the opportunity adapter config for the given chain ID from the server and caches it in the searcher's state.

        Args:
            chain_id: The chain ID for which to get the opportunity adapter config.
        """
        opportunity_adapter_config = await self.client.get_opportunity_adapter_config(
            chain_id
        )
        self.opportunity_adapter_configs[chain_id] = opportunity_adapter_config

    def assess_opportunity(
        self,
        opp: Opportunity,
    ) -> OpportunityBid | None:
        """
        Assesses whether an opportunity is worth executing; if so, returns an OpportunityBid object. Otherwise returns None.

        This function determines whether the given opportunity is worthwhile to execute.
        There are many ways to evaluate this, but the most common way is to check that the value of the tokens the searcher will receive from execution exceeds the value of the tokens spent.
        Individual searchers will have their own methods to determine market impact and the profitability of executing an opportunity. This function can use external prices to perform this evaluation.
        In this simple searcher, the function (naively) returns an OpportunityBid object with a default bid and deadline timestamp.
        Args:
            opp: An object representing a single opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return an OpportunityBid object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """

        # TODO: generate nonce more intelligently?
        bid_params = OpportunityBidParams(
            amount=NAIVE_BID, nonce=randbits(64), deadline=DEADLINE_MAX
        )

        if opp.chain_id not in self.opportunity_adapter_configs:
            logger.error(
                "Opportunity adapter config not found for chain %d", opp.chain_id
            )
            return None

        opportunity_adapter_config = self.opportunity_adapter_configs[opp.chain_id]

        opportunity_bid = sign_bid(
            opp, opportunity_adapter_config, bid_params, self.private_key
        )

        return opportunity_bid

    async def opportunity_callback(self, opp: Opportunity):
        """
        Callback function to run when a new opportunity is found.

        Args:
            opp: An object representing a single opportunity.
        """
        opportunity_bid = self.assess_opportunity(opp)
        if opportunity_bid:
            try:
                await self.client.submit_opportunity_bid(opportunity_bid)
                logger.info(
                    f"Submitted bid amount {opportunity_bid.amount} for opportunity {str(opportunity_bid.opportunity_id)}"
                )
            except Exception as e:
                logger.error(
                    f"Error submitting bid amount {opportunity_bid.amount} for opportunity {str(opportunity_bid.opportunity_id)}: {e}"
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
        index = bid_status_update.index

        result_details = ""
        if bid_status == BidStatus("submitted") or bid_status == BidStatus("won"):
            result_details = f", transaction {result}, index {index} of multicall"
        elif bid_status == BidStatus("lost"):
            if result:
                result_details = f", transaction {result}"
            if index:
                result_details += f", index {index} of multicall"
        logger.info(
            f"Bid status for bid {id}: {bid_status.value.replace('_', ' ')}{result_details}"
        )


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-v", "--verbose", action="count", default=0)
    parser.add_argument(
        "--private-key",
        type=str,
        required=True,
        help="Private key of the searcher for signing calldata as a hex string",
    )
    parser.add_argument(
        "--chain-ids",
        type=str,
        required=True,
        nargs="+",
        help="Chain ID(s) of the network(s) to monitor for opportunities",
    )
    parser.add_argument(
        "--server-url",
        type=str,
        required=True,
        help="Server endpoint to use for fetching opportunities and submitting bids",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        required=False,
        help="The API key of the searcher to authenticate with the server for fetching and submitting bids",
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

    simple_searcher = SimpleSearcher(args.server_url, args.private_key, args.api_key)
    logger.info("Searcher address: %s", simple_searcher.public_key)

    await simple_searcher.client.subscribe_chains(args.chain_ids)

    for chain_id in args.chain_ids:
        await simple_searcher.query_opportunity_adapter_config(chain_id)

    task = await simple_searcher.client.get_ws_loop()
    await task


if __name__ == "__main__":
    asyncio.run(main())
