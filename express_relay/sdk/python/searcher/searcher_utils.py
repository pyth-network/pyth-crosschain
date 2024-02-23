from typing import TypedDict

import web3
from eth_abi import encode
from eth_account.datastructures import SignedMessage
from eth_account import Account
from web3.auto import w3
import httpx
import urllib.parse
import websockets
import json

from utils.types_liquidation_adapter import OpportunityBid, LiquidationOpportunity


class BidInfo(TypedDict):
    bid: int
    valid_until: int

class SearcherClient:
    def __init__(self, private_key: str, chain_id: str, liquidation_server_url: str):
        self.private_key = private_key
        self.liquidator = Account.from_key(private_key).address
        self.chain_id = chain_id
        self.liquidation_server_url = liquidation_server_url
        if self.liquidation_server_url.startswith("https"):
            self.ws_endpoint = f"wss{self.liquidation_server_url[5:]}/v1/ws"
        elif self.liquidation_server_url.startswith("http"):
            self.ws_endpoint = f"ws{self.liquidation_server_url[4:]}/v1/ws"
        else:
            raise ValueError("Invalid liquidation server URL")
        self.ws_msg_counter = 0

    async def get_liquidation_opportunities(self) -> list[LiquidationOpportunity]:
        async with httpx.AsyncClient() as client:
            opportunities = (
                await client.get(
                    urllib.parse.urljoin(
                        self.liquidation_server_url, "/v1/liquidation/opportunities"
                    ),
                    params={"chain_id": self.chain_id},
                )
            ).json()

        return opportunities

    async def ws_liquidation_opportunities(self, opportunity_handler):
        """
        Connects to the liquidation server's websocket and handles new liquidation opportunities.

        Args:
            opportunity_handler (async func): An async function that defines how to handle new liquidation opportunities. Should take in one external argument of type LiquidationOpportunity.
        """
        async with websockets.connect(self.ws_endpoint) as ws:
            json_subscribe = {
                "method": "subscribe",
                "params": {
                    "chain_ids": [self.chain_id],
                },
                "id": str(self.ws_msg_counter),
            }
            await ws.send(json.dumps(json_subscribe))
            self.ws_msg_counter += 1

            while True:
                msg = json.loads(await ws.recv())
                status = msg.get("status")
                if status and status != "success":
                    raise Exception(f"Error in websocket subscription: {msg.get('result')}")

                try:
                    if msg.get("type") != "new_opportunity":
                        continue

                    opportunity = msg["opportunity"]
                    await opportunity_handler(opportunity)

                except Exception as e:
                    raise Exception(f"Error in websocket message: {e}")

    async def submit_bid(self, opportunity_bid: OpportunityBid):
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urljoin(
                    self.liquidation_server_url,
                    f"/v1/liquidation/opportunities/{opportunity_bid['opportunity_id']}/bids",
                ),
                json=opportunity_bid,
                timeout=20,
            )
        return resp

    def construct_signature_liquidator(
        self,
        liquidation_opportunity: LiquidationOpportunity,
        bid_info: BidInfo,
    ) -> SignedMessage:
        """
        Constructs a signature for a liquidator's bid to submit to the liquidation server.

        Args:
            liquidation_opportunity: An object of type LiquidationOpportnity.
            bid_info: An object of type BidInfo representing the bid amount and validity constraints set by the liquidator.
        Returns:
            A SignedMessage object, representing the liquidator's signature.
        """

        repay_tokens = [(token["contract"], int(token["amount"])) for token in liquidation_opportunity["repay_tokens"]]
        receipt_tokens = [(token["contract"], int(token["amount"])) for token in liquidation_opportunity["receipt_tokens"]]
        calldata = bytes.fromhex(liquidation_opportunity["calldata"].replace("0x", ""))

        digest = encode(
            [
                "(address,uint256)[]",
                "(address,uint256)[]",
                "address",
                "bytes",
                "uint256",
                "uint256",
                "uint256",
            ],
            [
                repay_tokens,
                receipt_tokens,
                liquidation_opportunity["contract"],
                calldata,
                int(liquidation_opportunity["value"]),
                bid_info["bid"],
                bid_info["valid_until"],
            ],
        )
        msg_data = web3.Web3.solidity_keccak(["bytes"], [digest])
        signature = w3.eth.account.signHash(msg_data, private_key=self.private_key)

        return signature
