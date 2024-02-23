import argparse
import asyncio
import logging

from searcher.searcher_utils import BidInfo, SearcherClient
from utils.types_liquidation_adapter import LiquidationOpportunity, OpportunityBid

logger = logging.getLogger(__name__)

VALID_UNTIL = 1_000_000_000_000

class SimpleSearcher(SearcherClient):
    def __init__(self, private_key: str, chain_id: str, liquidation_server_url: str, default_bid: int):
        super().__init__(private_key, chain_id, liquidation_server_url)
        self.default_bid = default_bid

    def assess_liquidation_opportunity(
        self,
        opp: LiquidationOpportunity,
    ) -> BidInfo | None:
        """
        Assesses whether a liquidation opportunity is worth liquidating; if so, returns the bid and valid_until timestamp. Otherwise returns None.
        This function determines whether the given opportunity deals with the specified repay and receipt tokens that the searcher wishes to transact in and whether it is profitable to execute the liquidation.
        There are many ways to evaluate this, but the most common way is to check that the value of the amount the searcher will receive from the liquidation exceeds the value of the amount repaid.
        Individual searchers will have their own methods to determine market impact and the profitability of conducting a liquidation. This function can be expanded to include external prices to perform this evaluation.
        If the opporutnity is deemed worthwhile, this function can return a bid amount representing the amount of native token to bid on this opportunity, and a timestamp representing the time at which the transaction will expire.
        Otherwise, this function can return None.
        In this simple searcher, the function always (naively) returns the default bid and a valid_until timestamp.
        Args:
            default_bid: The default amount of bid for liquidation opportunities.
            opp: A LiquidationOpportunity object, representing a single liquidation opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return a BidInfo object, representing the user's bid and the timestamp at which the user's bid should expire. If the LiquidationOpportunity is not deemed worthwhile, this function can return None.
        """
        user_liquidation_params = {
            "bid": self.default_bid,
            "valid_until": VALID_UNTIL,
        }
        return user_liquidation_params

    def create_liquidation_transaction(
        self, opp: LiquidationOpportunity, bid_info: BidInfo
    ) -> OpportunityBid:
        """
        Creates a bid for a liquidation opportunity.
        Args:
            opp: A LiquidationOpportunity object, representing a single liquidation opportunity.
            sk_liquidator: A 0x-prefixed hex string representing the liquidator's private key.
            bid_info: necessary information for the liquidation bid
        Returns:
            An OpportunityBid object which can be sent to the liquidation server
        """
        signature_liquidator = self.construct_signature_liquidator(
            opp,
            bid_info,
        )

        opportunity_bid = {
            "opportunity_id": opp["opportunity_id"],
            "permission_key": opp["permission_key"],
            "amount": str(bid_info["bid"]),
            "valid_until": str(bid_info["valid_until"]),
            "liquidator": self.liquidator,
            "signature": bytes(signature_liquidator.signature).hex(),
        }

        return opportunity_bid

    async def ws_opportunity_handler(
        self, opp: LiquidationOpportunity
    ):
        bid_info = self.assess_liquidation_opportunity(opp)
        opp_bid = self.create_liquidation_transaction(opp, bid_info)
        resp = await self.submit_bid(opp_bid)
        logger.info(
            "Submitted bid amount %s for opportunity %s, server response: %s",
            bid_info["bid"],
            opp_bid["opportunity_id"],
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
                opp_id = liquidation_opportunity["opportunity_id"]
                if liquidation_opportunity["version"] != "v1":
                    logger.warning(
                        "Opportunity %s has unsupported version %s",
                        opp_id,
                        liquidation_opportunity["version"],
                    )
                    continue
                bid_info = simple_searcher.assess_liquidation_opportunity(liquidation_opportunity)

                if bid_info is not None:
                    tx = simple_searcher.create_liquidation_transaction(liquidation_opportunity, bid_info)

                    resp = await simple_searcher.submit_bid(tx)
                    logger.info(
                        "Submitted bid amount %s for opportunity %s, server response: %s",
                        bid_info["bid"],
                        opp_id,
                        resp.text,
                    )

            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
