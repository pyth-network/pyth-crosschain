import argparse
import asyncio
import logging
from eth_account.account import Account

from searcher_utils import BidInfo, SearcherClient

from openapi_client.models.opportunity_bid import OpportunityBid
from openapi_client.models.opportunity_params_with_metadata import OpportunityParamsWithMetadata

logger = logging.getLogger(__name__)

VALID_UNTIL = 1_000_000_000_000

class SimpleSearcher(SearcherClient):
    def __init__(self, liquidation_server_url: str, private_key: str, default_bid: int):
        super().__init__(liquidation_server_url)
        self.private_key = private_key
        self.liquidator = Account.from_key(private_key).address
        self.default_bid = default_bid

    def assess_liquidation_opportunity(
        self,
        opp: OpportunityParamsWithMetadata,
    ) -> BidInfo | None:
        """
        Assesses whether a liquidation opportunity is worth liquidating; if so, returns a BidInfo object. Otherwise returns None.
        This function determines whether the given opportunity deals with the specified repay and receipt tokens that the searcher wishes to transact in and whether it is profitable to execute the liquidation.
        There are many ways to evaluate this, but the most common way is to check that the value of the amount the searcher will receive from the liquidation exceeds the value of the amount repaid.
        Individual searchers will have their own methods to determine market impact and the profitability of conducting a liquidation. This function can be expanded to include external prices to perform this evaluation.
        In this simple searcher, the function always (naively) returns a BidInfo object with the default bid and a valid_until timestamp.
        Args:
            opp: A OpportunityParamsWithMetadata object, representing a single liquidation opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return a BidInfo object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """
        bid_info = self.sign_bid(
            opp,
            self.default_bid,
            VALID_UNTIL,
            self.private_key
        )

        return bid_info

    async def ws_opportunity_handler(
        self, opp: OpportunityParamsWithMetadata
    ):
        bid_info = self.assess_liquidation_opportunity(opp)
        if bid_info:
            try:
                await self.submit_bid(bid_info)
                logger.info(f"Submitted bid amount {bid_info.opportunity_bid.amount} for opportunity {bid_info.opportunity_id}")
            except Exception as e:
                logger.error(f"Error submitting bid amount {bid_info.opportunity_bid.amount} for opportunity {bid_info.opportunity_id}: {e}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-v", "--verbose", action="count", default=0)
    parser.add_argument(
        "--private-key",
        type=str,
        required=True,
        help="Private key of the searcher for signing calldata",
    )
    parser.add_argument(
        "--chain-ids",
        type=str,
        required=True,
        nargs="+",
        help="Chain ID(s) of the network(s) to monitor for liquidation opportunities",
    )
    parser.add_argument(
        "--bid",
        type=int,
        default=10,
        help="Default amount of bid for liquidation opportunities",
    )
    parser.add_argument(
        "--liquidation-server-url",
        type=str,
        required=True,
        help="Liquidation server endpoint to use for fetching opportunities and submitting bids",
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

    sk_liquidator = args.private_key

    simple_searcher = SimpleSearcher(args.liquidation_server_url, sk_liquidator, args.bid)
    logger.info("Liquidator address: %s", simple_searcher.liquidator)

    await simple_searcher.ws_liquidation_opportunities(args.chain_ids, simple_searcher.ws_opportunity_handler)

if __name__ == "__main__":
    asyncio.run(main())
