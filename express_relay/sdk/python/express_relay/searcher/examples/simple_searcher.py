import argparse
import asyncio
import logging
from eth_account.account import Account
from express_relay.client import ExpressRelayClient, sign_bid
from express_relay.express_relay_types import (
    Opportunity,
    OpportunityBid,
    Bytes32,
    BidStatus,
    BidStatusUpdate,
)

logger = logging.getLogger(__name__)

NAIVE_BID = 10
# Set validity (naively) to max uint256
VALID_UNTIL_MAX = 2**256 - 1


class SimpleSearcher:
    def __init__(self, server_url: str, private_key: Bytes32):
        self.client = ExpressRelayClient(
            server_url, self.opportunity_callback, self.bid_status_callback
        )
        self.private_key = private_key
        self.public_key = Account.from_key(private_key).address

    def assess_opportunity(
        self,
        opp: Opportunity,
    ) -> OpportunityBid | None:
        """
        Assesses whether an opportunity is worth executing; if so, returns an OpportunityBid object. Otherwise returns None.

        This function determines whether the given opportunity is worthwhile to execute.
        There are many ways to evaluate this, but the most common way is to check that the value of the tokens the searcher will receive from execution exceeds the value of the tokens spent.
        Individual searchers will have their own methods to determine market impact and the profitability of executing an opportunity. This function can use external prices to perform this evaluation.
        In this simple searcher, the function always (naively) returns an OpportunityBid object with a default bid and valid_until timestamp.
        Args:
            opp: An object representing a single opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return an OpportunityBid object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """
        opportunity_bid = sign_bid(opp, NAIVE_BID, VALID_UNTIL_MAX, self.private_key)

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
        logger.error(
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
    args = parser.parse_args()

    logger.setLevel(logging.INFO if args.verbose == 0 else logging.DEBUG)
    log_handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s:%(name)s:%(module)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log_handler.setFormatter(formatter)
    logger.addHandler(log_handler)

    simple_searcher = SimpleSearcher(args.server_url, args.private_key)
    logger.info("Searcher address: %s", simple_searcher.public_key)

    await simple_searcher.client.subscribe_chains(args.chain_ids)

    task = await simple_searcher.client.get_ws_loop()
    await task


if __name__ == "__main__":
    asyncio.run(main())
