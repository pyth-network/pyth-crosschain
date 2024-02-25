import argparse
import asyncio
import logging

from searcher_utils import BidInfo, SearcherClient

from schema.openapi_client.models.opportunity_bid import OpportunityBid
from schema.openapi_client.models.opportunity_params_with_metadata import OpportunityParamsWithMetadata

logger = logging.getLogger(__name__)

VALID_UNTIL = 1_000_000_000_000

class SimpleSearcher(SearcherClient):
    def __init__(self, private_key: str, chain_id: str, liquidation_server_url: str, default_bid: int):
        super().__init__(private_key, chain_id, liquidation_server_url)
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
            default_bid: The default amount of bid for liquidation opportunities.
            opp: A OpportunityParamsWithMetadata object, representing a single liquidation opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return a BidInfo object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """
        signature_liquidator = self.construct_signature_liquidator(
            opp,
            self.default_bid,
            VALID_UNTIL,
        )

        opportunity_bid = {
            "permission_key": opp.permission_key,
            "amount": str(self.default_bid),
            "valid_until": str(VALID_UNTIL),
            "liquidator": self.liquidator,
            "signature": bytes(signature_liquidator.signature).hex(),
        }
        opportunity_bid = OpportunityBid.from_dict(opportunity_bid)

        bid_info = BidInfo(
            opportunity_id=opp.opportunity_id,
            opportunity_bid=opportunity_bid,
        )

        return bid_info

    async def ws_opportunity_handler(
        self, opp: OpportunityParamsWithMetadata
    ):
        bid_info = self.assess_liquidation_opportunity(opp)
        resp = await self.submit_bid(bid_info)
        logger.info(
            "Submitted bid amount %s for opportunity %s, server response: %s",
            bid_info.opportunity_bid.amount,
            bid_info.opportunity_id,
            resp.text,
        )


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
        "--chain-id",
        type=str,
        required=True,
        help="Chain ID of the network to monitor for liquidation opportunities",
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
    parser.add_argument(
        "--use-ws",
        action="store_true",
        dest="use_ws",
        default=False,
        help="Use websocket to fetch liquidation opportunities",
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

    simple_searcher = SimpleSearcher(sk_liquidator, args.chain_id, args.liquidation_server_url, args.bid)
    logger.info("Liquidator address: %s", simple_searcher.liquidator)

    if args.use_ws:
        logging.debug("Using websocket to fetch liquidation opportunities")
        await simple_searcher.ws_liquidation_opportunities(simple_searcher.ws_opportunity_handler)
    else:
        logging.debug("Using http to fetch liquidation opportunities")

        while True:
            try:
                liquidation_opportunities = await simple_searcher.get_liquidation_opportunities()
            except Exception as e:
                logger.error(e)
                await asyncio.sleep(5)
                continue

            logger.debug("Found %d liquidation opportunities", len(liquidation_opportunities))

            for liquidation_opportunity in liquidation_opportunities:
                opp_id = liquidation_opportunity.opportunity_id
                if liquidation_opportunity.version != "v1":
                    logger.warning(
                        "Opportunity %s has unsupported version %s",
                        opp_id,
                        liquidation_opportunity.version,
                    )
                    continue
                bid_info = simple_searcher.assess_liquidation_opportunity(liquidation_opportunity)

                if bid_info is not None:
                    resp = await simple_searcher.submit_bid(bid_info)
                    logger.info(
                        "Submitted bid amount %s for opportunity %s, server response: %s",
                        bid_info.opportunity_bid.amount,
                        bid_info.opportunity_id,
                        resp.text,
                    )

            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
