import asyncio
import json
import urllib.parse
from typing import Callable
from uuid import UUID

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
    def __init__(self, opportunity_id: UUID, opportunity_bid: OpportunityBid):
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
        self.ws = None
        self.ws_lock = asyncio.Lock()
        self.ws_task = None
        self.ws_msg_futures = {}

    async def start_ws(
        self,
        opportunity_callback: (
            Callable[[OpportunityParamsWithMetadata], None] | None
        ) = None,
        **kwargs,
    ) -> asyncio.Task:
        """
        Initializes the websocket connection to the server, if not already connected.

        Args:
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
            kwargs: Keyword arguments to pass to the websocket connection.
        Returns:
            The websocket task.
        """
        async with self.ws_lock:
            if self.ws is None:
                self.ws = await websockets.connect(self.ws_endpoint, **kwargs)

            if self.ws_task is None:
                ws_call = self.ws_handler(opportunity_callback)
                self.ws_task = asyncio.create_task(ws_call)

        return self.ws_task

    async def close_ws(self):
        """
        Closes the websocket connection to the server.
        """
        async with self.ws_lock:
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
        await self.start_ws()

        # validate the format of msg
        msg = ClientMessage.from_dict(msg).to_dict()
        msg["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        future = asyncio.get_event_loop().create_future()
        self.ws_msg_futures[msg["id"]] = future

        await self.ws.send(json.dumps(msg))

        # await the response for the subscription from the server
        msg = await future

        self.process_response_msg(msg)

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

    def process_response_msg(self, msg: dict):
        """
        Processes a response message received from the server via websocket.

        Args:
            msg: The message to process.
        """
        if msg.get("status") and msg.get("status") != "success":
            raise ExpressRelayClientException(
                f"Error in websocket with message id {msg.get('id')}: {msg.get('result')}"
            )

    async def ws_handler(
        self,
        opportunity_callback: (
            Callable[[OpportunityParamsWithMetadata], None] | None
        ) = None,
    ):
        """
        Continuously handles new ws messages as they are received from the server via websocket.

        Args:
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket not connected")

        async for msg in self.ws:
            msg = json.loads(msg)
            if msg.get("id"):
                future = self.ws_msg_futures.pop(msg["id"])
                future.set_result(msg)

            if msg.get("type") == "new_opportunity":
                opportunity = OpportunityParamsWithMetadata.from_dict(
                    msg["opportunity"]
                )

                if opportunity_callback is not None:
                    asyncio.create_task(opportunity_callback(opportunity))

    async def submit_opportunity(
        self, opportunity: OpportunityParams, timeout: int = 10
    ) -> UUID:
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
        return UUID(resp.json()["opportunity_id"])

    async def submit_bid(self, bid_info: BidInfo, timeout: int = 10) -> UUID:
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
                    path=f"/v1/liquidation/opportunities/{str(bid_info.opportunity_id)}/bids"
                )
                .geturl(),
                json=bid_info.opportunity_bid.to_dict(),
                timeout=timeout,
            )
        resp.raise_for_status()
        return UUID(resp.json()["id"])


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
        opportunity_id=UUID(liquidation_opportunity.opportunity_id),
        opportunity_bid=opportunity_bid,
    )

    return bid_info
