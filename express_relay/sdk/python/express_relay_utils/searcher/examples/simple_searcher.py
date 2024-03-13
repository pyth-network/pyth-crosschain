import argparse
import asyncio
import logging

from eth_account.account import Account
from express_relay_utils.express_relay_client import ExpressRelayClient, sign_bid
from express_relay_utils.express_relay_types import *

logger = logging.getLogger(__name__)

NAIVE_BID = 10
# Set validity (naively) to max uint256
VALID_UNTIL_MAX = 2**256 - 1


class SimpleSearcher:
    def __init__(self, server_url: str, private_key: str):
        self.client = ExpressRelayClient(
            server_url, self.opportunity_callback, self.bid_status_callback
        )
        self.private_key = Bytes32(string=private_key).string
        self.public_key = Account.from_key(private_key).address

    def assess_opportunity(
        self,
        opp: OpportunityParamsWithMetadata,
    ) -> OpportunityBidInfo | None:
        """
        Assesses whether an opportunity is worth executing; if so, returns an OpportunityBidInfo object. Otherwise returns None.

        This function determines whether the given opportunity deals with the specified repay and receipt tokens that the searcher wishes to transact in and whether it is profitable to execute the opportunity.
        There are many ways to evaluate this, but the most common way is to check that the value of the tokens the searcher will receive from execution exceeds the value of tokens spent.
        Individual searchers will have their own methods to determine market impact and the profitability of executing an opportunity. This function can be expanded to include external prices to perform this evaluation.
        In this simple searcher, the function always (naively) returns an OpportunityBidInfo object with a default bid and valid_until timestamp.
        Args:
            opp: A OpportunityParamsWithMetadata object, representing a single opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return an OpportunityBidInfo object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """
        opportunity_bid_info = sign_bid(
            opp, NAIVE_BID, VALID_UNTIL_MAX, self.private_key
        )

        return opportunity_bid_info

    async def opportunity_callback(self, opp: OpportunityParamsWithMetadata):
        """
        Callback function to run when a new opportunity is found.

        Args:
            opp: A OpportunityParamsWithMetadata object, representing a single opportunity.
        """
        opportunity_bid_info = self.assess_opportunity(opp)
        if opportunity_bid_info:
            try:
                await self.client.submit_opportunity_bid(opportunity_bid_info)
                logger.info(
                    f"Submitted bid amount {opportunity_bid_info.opportunity_bid.amount} for opportunity {str(opportunity_bid_info.opportunity_id)}"
                )
            except Exception as e:
                logger.error(
                    f"Error submitting bid amount {opportunity_bid_info.opportunity_bid.amount} for opportunity {str(opportunity_bid_info.opportunity_id)}: {e}"
                )

    async def bid_status_callback(self, bid_status_with_id: BidStatusWithId):
        """
        Callback function to run when a bid status is updated.

        Args:
            bid_status_with_id: A BidStatusWithId object, representing the status of a bid.
        """
        bid_id = bid_status_with_id.id
        bid_status = bid_status_with_id.bid_status

        if bid_status.status == Status("submitted"):
            logger.info(f"Bid {bid_id} has been submitted in hash {bid_status.result}")
        elif bid_status.status == Status("lost"):
            logger.info(f"Bid {bid_id} was unsuccessful")
        elif bid_status.status == Status("pending"):
            logger.info(f"Bid {bid_id} is pending")
        else:
            logger.error(f"Unrecognized status {bid_status.status} for bid {bid_id}")


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
