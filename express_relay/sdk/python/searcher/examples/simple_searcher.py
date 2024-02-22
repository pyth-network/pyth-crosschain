import argparse
import asyncio
import logging
import urllib.parse
from typing import TypedDict

import httpx
from eth_account import Account

from searcher.searcher_utils import BidInfo, construct_signature_liquidator
from utils.types_liquidation_adapter import LiquidationOpportunity

logger = logging.getLogger(__name__)

VALID_UNTIL = 1_000_000_000_000


def assess_liquidation_opportunity(
    default_bid: int,
    opp: LiquidationOpportunity,
) -> BidInfo | None:
    """
    Assesses whether a liquidation opportunity is worth liquidating; if so, returns the bid and valid_until timestamp. Otherwise returns None.
    This function determines whether the given opportunity deals with the specified repay and receipt tokens that the searcher wishes to transact in and whether it is profitable to execute the liquidation.
    There are many ways to evaluate this, but the most common way is to check that the value of the amount the searcher will receive from the liquidation exceeds the value of the amount repaid.
    Individual searchers will have their own methods to determine market impact and the profitability of conducting a liquidation. This function can be expanded to include external prices to perform this evaluation.
    If the opporutnity is deemed worthwhile, this function can return a bid amount representing the amount of native token to bid on this opportunity, and a timestamp representing the time at which the transaction will expire.
    Otherwise, this function can return None.
    Args:
        default_bid: The default amount of bid for liquidation opportunities.
        opp: A LiquidationOpportunity object, representing a single liquidation opportunity.
    Returns:
        If the opportunity is deemed worthwhile, this function can return a BidInfo object, representing the user's bid and the timestamp at which the user's bid should expire. If the LiquidationOpportunity is not deemed worthwhile, this function can return None.
    """
    user_liquidation_params = {
        "bid": default_bid,
        "valid_until": VALID_UNTIL,
    }
    return user_liquidation_params


class OpportunityBid(TypedDict):
    opportunity_id: str
    permission_key: str
    amount: str
    valid_until: str
    liquidator: str
    signature: str


def create_liquidation_transaction(
    opp: LiquidationOpportunity, sk_liquidator: str, bid_info: BidInfo
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
    repay_tokens = [
        (opp["contract"], int(opp["amount"])) for opp in opp["repay_tokens"]
    ]
    receipt_tokens = [
        (opp["contract"], int(opp["amount"])) for opp in opp["receipt_tokens"]
    ]

    liquidator = Account.from_key(sk_liquidator).address
    liq_calldata = bytes.fromhex(opp["calldata"].replace("0x", ""))

    signature_liquidator = construct_signature_liquidator(
        repay_tokens,
        receipt_tokens,
        opp["contract"],
        liq_calldata,
        int(opp["value"]),
        bid_info,
        sk_liquidator,
    )

    opportunity_bid = {
        "opportunity_id": opp["opportunity_id"],
        "permission_key": opp["permission_key"],
        "amount": str(bid_info["bid"]),
        "valid_until": str(bid_info["valid_until"]),
        "liquidator": liquidator,
        "signature": bytes(signature_liquidator.signature).hex(),
    }

    return opportunity_bid


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
    liquidator = Account.from_key(sk_liquidator).address
    logger.info("Liquidator address: %s", liquidator)
    client = httpx.AsyncClient()
    while True:
        try:
            accounts_liquidatable = (
                await client.get(
                    urllib.parse.urljoin(
                        args.liquidation_server_url, "/v1/liquidation/opportunities"
                    ),
                    params={"chain_id": args.chain_id},
                )
            ).json()
        except Exception as e:
            logger.error(e)
            await asyncio.sleep(5)
            continue

        logger.debug("Found %d liquidation opportunities", len(accounts_liquidatable))

        for liquidation_opp in accounts_liquidatable:
            opp_id = liquidation_opp["opportunity_id"]
            if liquidation_opp["version"] != "v1":
                logger.warning(
                    "Opportunity %s has unsupported version %s",
                    opp_id,
                    liquidation_opp["version"],
                )
                continue
            bid_info = assess_liquidation_opportunity(args.bid, liquidation_opp)

            if bid_info is not None:
                tx = create_liquidation_transaction(
                    liquidation_opp, sk_liquidator, bid_info
                )

                resp = await client.post(
                    urllib.parse.urljoin(
                        args.liquidation_server_url,
                        f"/v1/liquidation/opportunities/{opp_id}/bids",
                    ),
                    json=tx,
                    timeout=20,
                )
                logger.info(
                    "Submitted bid amount %s for opportunity %s, server response: %s",
                    bid_info["bid"],
                    opp_id,
                    resp.text,
                )

        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
