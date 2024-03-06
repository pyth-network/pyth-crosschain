import asyncio
import json
import urllib.parse
from typing import Callable

import httpx
import web3
import websockets
from eth_abi import encode
from eth_account.account import Account
from openapi_client.models.client_message import ClientMessage
from openapi_client.models.opportunity_bid import OpportunityBid
from openapi_client.models.opportunity_params import OpportunityParams
from openapi_client.models.opportunity_params_with_metadata import (
    OpportunityParamsWithMetadata,
)
from web3.auto import w3


class BidInfo:
    def __init__(self, opportunity_id: str, opportunity_bid: OpportunityBid):
        self.opportunity_id = opportunity_id
        self.opportunity_bid = opportunity_bid


class ExpressRelayClientException(Exception):
    pass


class ExpressRelayClient:
    def __init__(self, server_url: str):
        parsed_url = urllib.parse.urlparse(server_url)
        if parsed_url.scheme == "https":
            ws_scheme = "wss"
        elif parsed_url.scheme == "http":
            ws_scheme = "ws"
        else:
            raise ValueError("Invalid liquidation server URL")

        self.server_url = server_url
        self.ws_endpoint = parsed_url._replace(scheme=ws_scheme, path="/v1/ws").geturl()
        self.ws_msg_counter = 0
        self.ws = False

    async def start_ws(self, **kwargs):
        """
        Initializes the websocket connection to the server, if not already connected.

        Args:
            kwargs: Keyword arguments to pass to the websocket connection.
        """
        if not self.ws:
            self.ws = await websockets.connect(self.ws_endpoint, **kwargs)

    async def close_ws(self):
        """
        Closes the websocket connection to the server.
        """
        await self.ws.close()

    async def get_opportunities(
        self, chain_id: str | None = None, timeout: int = 10
    ) -> list[OpportunityParamsWithMetadata]:
        """
        Connects to the liquidation server and fetches liquidation opportunities.

        Args:
            chain_id: The chain ID to fetch liquidation opportunities for. If None, fetches opportunities across all chains.
            timeout: The timeout for the HTTP request in seconds.
        Returns:
            A list of liquidation opportunities.
        """
        params = {}
        if chain_id:
            params["chain_id"] = chain_id

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/liquidation/opportunities")
                .geturl(),
                params=params,
                timeout=timeout,
            )

        resp.raise_for_status()

        opportunities = [
            OpportunityParamsWithMetadata.from_dict(opportunity)
            for opportunity in resp.json()
        ]

        return opportunities

    async def send_ws_message(self, msg: dict):
        """
        Sends a message to the server via websocket.

        Args:
            msg: The message to send.
        """
        if not self.ws:
            await self.start_ws()

        # validate the format of msg
        msg = ClientMessage.from_dict(msg).to_dict()
        msg["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        await self.ws.send(json.dumps(msg))

    async def subscribe_chains(self, chain_ids: list[str]):
        """
        Subscribes websocket to a list of chain IDs for new liquidation opportunities.

        Args:
            chain_ids: A list of chain IDs to subscribe to.
        """
        json_subscribe = {
            "method": "subscribe",
            "params": {
                "chain_ids": chain_ids,
            },
        }
        await self.send_ws_message(json_subscribe)

    async def unsubscribe_chains(self, chain_ids: list[str]):
        """
        Unsubscribes websocket from a list of chain IDs for new liquidation opportunities.

        Args:
            chain_ids: A list of chain IDs to unsubscribe from.
        """
        json_unsubscribe = {
            "method": "unsubscribe",
            "params": {
                "chain_ids": chain_ids,
            },
        }
        await self.send_ws_message(json_unsubscribe)

    async def ws_opportunities_handler(
        self, opportunity_callback: Callable[[OpportunityParamsWithMetadata], None]
    ):
        """
        Continuously handles new liquidation opportunities as they are received from the server via websocket.

        Args:
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
        """
        if not self.ws:
            await self.start_ws()

        while True:
            msg = json.loads(await self.ws.recv())
            status = msg.get("status")
            if status and status != "success":
                raise ExpressRelayClientException(
                    f"Error in websocket subscription: {msg.get('result')}"
                )

            if msg.get("type") != "new_opportunity":
                continue

            opportunity = msg["opportunity"]
            opportunity = OpportunityParamsWithMetadata.from_dict(opportunity)
            asyncio.create_task(opportunity_callback(opportunity))

    async def submit_opportunity(
        self, opportunity: OpportunityParams, timeout: int = 10
    ) -> str:
        """
        Submits an opportunity to the liquidation server.

        Args:
            opportunity: An object representing the opportunity to submit.
            timeout: The timeout for the HTTP request in seconds.
        Returns:
            The ID of the submitted opportunity.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/liquidation/opportunities")
                .geturl(),
                json=opportunity.to_dict(),
                timeout=timeout,
            )
        resp.raise_for_status()
        return resp.json()["opportunity_id"]

    async def submit_bid(self, bid_info: BidInfo, timeout: int = 10) -> str:
        """
        Submits a bid to the liquidation server.

        Args:
            bid_info: An object representing the bid to submit.
            timeout: The timeout for the HTTP request in seconds.
        Returns:
            The ID of the submitted bid.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urlparse(self.server_url)
                ._replace(
                    path=f"/v1/liquidation/opportunities/{bid_info.opportunity_id}/bids"
                )
                .geturl(),
                json=bid_info.opportunity_bid.to_dict(),
                timeout=timeout,
            )
        resp.raise_for_status()
        return resp.json()["id"]


def sign_bid(
    liquidation_opportunity: OpportunityParamsWithMetadata,
    bid: int,
    valid_until: int,
    private_key: str,
) -> BidInfo:
    """
    Constructs a signature for a liquidator's bid and returns the BidInfo object to be submitted to the liquidation server.

    Args:
        liquidation_opportunity: An object representing the liquidation opportunity, of type OpportunityParamsWithMetadata.
        bid: An integer representing the amount of the bid.
        valid_until: An integer representing the block until which the bid is valid.
        private_key: A 0x-prefixed hex string representing the liquidator's private key.
    Returns:
        A BidInfo object, representing the transaction to submit to the liquidation server. This object contains the liquidator's signature.
    """
    repay_tokens = [
        (token.contract, int(token.amount))
        for token in liquidation_opportunity.repay_tokens
    ]
    receipt_tokens = [
        (token.contract, int(token.amount))
        for token in liquidation_opportunity.receipt_tokens
    ]
    calldata = bytes.fromhex(liquidation_opportunity.calldata.replace("0x", ""))

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
            liquidation_opportunity.contract,
            calldata,
            int(liquidation_opportunity.value),
            bid,
            valid_until,
        ],
    )
    msg_data = web3.Web3.solidity_keccak(["bytes"], [digest])
    signature = w3.eth.account.signHash(msg_data, private_key=private_key)

    opportunity_bid = {
        "permission_key": liquidation_opportunity.permission_key,
        "amount": str(bid),
        "valid_until": str(valid_until),
        "liquidator": Account.from_key(private_key).address,
        "signature": bytes(signature.signature).hex(),
    }
    opportunity_bid = OpportunityBid.from_dict(opportunity_bid)

    bid_info = BidInfo(
        opportunity_id=liquidation_opportunity.opportunity_id,
        opportunity_bid=opportunity_bid,
    )

    return bid_info
