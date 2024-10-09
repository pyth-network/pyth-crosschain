import argparse
import asyncio
import logging
import typing

from eth_account.account import Account
from secrets import randbits

from express_relay.client import (
    ExpressRelayClient,
    sign_bid,
)
from express_relay.constants import OPPORTUNITY_ADAPTER_CONFIGS
from express_relay.express_relay_types import (
    Opportunity,
    BidEvm,
    OpportunityBidParams,
    Bytes32,
    BidStatus,
    BidStatusUpdate,
    OpportunityEvm,
)

logger = logging.getLogger(__name__)

NAIVE_BID = int(1e16)
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
        self.private_key = private_key
        self.public_key = Account.from_key(private_key).address

    def assess_opportunity(
        self,
        opp: OpportunityEvm,
    ) -> BidEvm | None:
        """
        Assesses whether an opportunity is worth executing; if so, returns a Bid object.
        Otherwise, returns None.

        This function determines whether the given opportunity is worthwhile to execute.
        There are many ways to evaluate this, but the most common way is to check that the value of the tokens the searcher will receive from execution exceeds the value of the tokens spent.
        Individual searchers will have their own methods to determine market impact and the profitability of executing an opportunity. This function can use external prices to perform this evaluation.
        In this simple searcher, the function (naively) returns a Bid object with a default bid and deadline timestamp.
        Args:
            opp: An object representing a single opportunity.
        Returns:
            If the opportunity is deemed worthwhile, this function can return a Bid object, whose contents can be submitted to the auction server. If the opportunity is not deemed worthwhile, this function can return None.
        """

        # TODO: generate nonce more intelligently, to reduce gas costs
        bid_params = OpportunityBidParams(
            amount=NAIVE_BID, nonce=randbits(64), deadline=DEADLINE_MAX
        )

        bid = sign_bid(opp, bid_params, self.private_key)

        return bid

    async def opportunity_callback(self, opp: Opportunity):
        """
        Callback function to run when a new opportunity is found.

        Args:
            opp: An object representing a single opportunity.
        """
        bid = self.assess_opportunity(typing.cast(OpportunityEvm, opp))
        if bid:
            try:
                await self.client.submit_bid(bid)
                logger.info(
                    f"Submitted bid amount {bid.amount} for opportunity {str(opp.opportunity_id)}"
                )
            except Exception as e:
                logger.error(
                    f"Error submitting bid amount {bid.amount} for opportunity {str(opp.opportunity_id)}: {e}"
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
    for chain_id in args.chain_ids:
        if chain_id not in OPPORTUNITY_ADAPTER_CONFIGS:
            raise ValueError(
                f"Opportunity adapter config not found for chain {chain_id}"
            )
    await simple_searcher.client.subscribe_chains(args.chain_ids)

    task = await simple_searcher.client.get_ws_loop()
    await task


if __name__ == "__main__":
    asyncio.run(main())
