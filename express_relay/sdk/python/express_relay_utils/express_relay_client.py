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
from openapi_client.models.bid import Bid
from openapi_client.models.bid_status_with_id import BidStatusWithId
from openapi_client.models.client_message import ClientMessage
from openapi_client.models.opportunity_bid import OpportunityBid
from openapi_client.models.opportunity_params import OpportunityParams
from openapi_client.models.opportunity_params_with_metadata import (
    OpportunityParamsWithMetadata,
)
from web3.auto import w3


class BidInfo:
    def __init__(self, bid: Bid):
        self.bid = bid

    def to_dict(self):
        return {"bid": self.bid.to_dict()}


class OpportunityBidInfo:
    def __init__(self, opportunity_id: UUID, opportunity_bid: OpportunityBid):
        self.opportunity_id = opportunity_id
        self.opportunity_bid = opportunity_bid

    def to_dict(self):
        return {
            "opportunity_id": str(self.opportunity_id),
            "opportunity_bid": self.opportunity_bid.to_dict(),
        }


class ExpressRelayClientException(Exception):
    pass


class ExpressRelayClient:
    def __init__(
        self,
        server_url: str,
        opportunity_callback: (
            Callable[[OpportunityParamsWithMetadata], None] | None
        ) = None,
        bid_status_callback: Callable[[BidStatusWithId], None] | None = None,
        **kwargs,
    ):
        """
        Args:
            server_url: The URL of the liquidation server.
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatus.
            kwargs: Keyword arguments to pass to the websocket connection.
        """
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
        self.ws_loop = None
        self.ws_msg_futures = {}
        self.ws_options = kwargs
        self.opportunity_callback = opportunity_callback
        self.bid_status_callback = bid_status_callback

    async def start_ws(self):
        """
        Initializes the websocket connection to the server, if not already connected.
        """
        async with self.ws_lock:
            if self.ws is None:
                self.ws = await websockets.connect(self.ws_endpoint, **self.ws_options)

            if self.ws_loop is None:
                ws_call = self.ws_handler(
                    self.opportunity_callback, self.bid_status_callback
                )
                self.ws_loop = asyncio.create_task(ws_call)

    async def close_ws(self):
        """
        Closes the websocket connection to the server.
        """
        async with self.ws_lock:
            await self.ws.close()

    def get_ws_loop(self) -> asyncio.Task:
        """
        Returns the websocket handler loop.
        """
        return self.ws_loop

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

    async def send_ws_message(self, msg: dict) -> dict:
        """
        Sends a message to the server via websocket.

        Args:
            msg: The message to send.
        Returns:
            The result of the response message from the server.
        """
        await self.start_ws()

        # validate the format of msg
        msg = ClientMessage.from_dict(msg).to_dict()
        msg["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        future = asyncio.get_event_loop().create_future()
        self.ws_msg_futures[msg["id"]] = future

        await self.ws.send(json.dumps(msg))

        # await the response for the sent ws message from the server
        msg = await future

        return self.process_response_msg(msg)

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

    async def submit_bid(
        self, bid_info: BidInfo, subscribe: bool = True, **kwargs
    ) -> UUID:
        """
        Submits a bid to the liquidation server.

        Args:
            bid_info: An object representing the bid to submit.
            subscribe: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        bid_info_dict = bid_info.to_dict()
        if subscribe:
            json_submit_bid = {
                "method": "post_bid",
                "params": bid_info_dict,
            }
            result = await self.send_ws_message(json_submit_bid)
            bid_id = UUID(result.get("id"))
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(path="/v1/bids")
                    .geturl(),
                    json=bid_info.bid.to_dict(),
                    **kwargs,
                )

            resp.raise_for_status()
            bid_id = UUID(resp.json().get("id"))

        return bid_id

    async def submit_opportunity_bid(
        self, opportunity_bid_info: OpportunityBidInfo, subscribe: bool = True, **kwargs
    ) -> UUID:
        """
        Submits a bid on an opportunity to the liquidation server via websocket.

        Args:
            opportunity_bid_info: An object representing the bid to submit on an opportunity.
            subscribe: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        opportunity_bid_info_dict = opportunity_bid_info.to_dict()
        if subscribe:
            json_submit_opportunity_bid = {
                "method": "post_liquidation_bid",
                "params": opportunity_bid_info_dict(),
            }
            result = await self.send_ws_message(json_submit_opportunity_bid)
            bid_id = UUID(result.get("id"))
        else:
            opportunity_id = opportunity_bid_info_dict["opportunity_id"]
            opportunity_bid = opportunity_bid_info_dict["opportunity_bid"]

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(
                        path=f"/v1/liquidation/opportunities/{opportunity_id}/bids"
                    )
                    .geturl(),
                    json=opportunity_bid,
                    **kwargs,
                )

            resp.raise_for_status()
            bid_id = UUID(resp.json().get("id"))

        return bid_id

    def process_response_msg(self, msg: dict):
        """
        Processes a response message received from the server via websocket.

        Args:
            msg: The message to process.
        """
        if msg.get("status") and msg.get("status") != "success":
            raise ExpressRelayClientException(
                f"Error in websocket response with message id {msg.get('id')}: {msg.get('result')}"
            )
        return msg.get("result")

    async def ws_handler(
        self,
        opportunity_callback: (
            Callable[[OpportunityParamsWithMetadata], None] | None
        ) = None,
        bid_status_callback: Callable[[BidStatusWithId], None] | None = None,
    ):
        """
        Continuously handles new ws messages as they are received from the server via websocket.

        Args:
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatus.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket not connected")

        async for msg in self.ws:
            msg = json.loads(msg)

            if msg.get("type"):
                if msg.get("type") == "new_opportunity":
                    opportunity = OpportunityParamsWithMetadata.from_dict(
                        msg.get("opportunity")
                    )

                    if opportunity_callback is not None:
                        asyncio.create_task(opportunity_callback(opportunity))

                elif msg.get("type") == "bid_status_update":
                    if bid_status_callback is not None:
                        bid_status = BidStatusWithId.from_dict(msg.get("status"))
                        asyncio.create_task(bid_status_callback(bid_status))

            elif msg.get("id"):
                future = self.ws_msg_futures.pop(msg["id"])
                future.set_result(msg)

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


def sign_bid(
    liquidation_opportunity: OpportunityParamsWithMetadata,
    bid: int,
    valid_until: int,
    private_key: str,
) -> OpportunityBidInfo:
    """
    Constructs a signature for a liquidator's bid and returns the OpportunityBidInfo object to be submitted to the liquidation server.

    Args:
        liquidation_opportunity: An object representing the liquidation opportunity, of type OpportunityParamsWithMetadata.
        bid: An integer representing the amount of the bid (in wei).
        valid_until: An integer representing the unix timestamp until which the bid is valid.
        private_key: A 0x-prefixed hex string representing the liquidator's private key.
    Returns:
        A OpportunityBidInfo object, representing the transaction to submit to the liquidation server. This object contains the liquidator's signature.
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

    opportunity_bid_info = OpportunityBidInfo(
        opportunity_id=UUID(liquidation_opportunity.opportunity_id),
        opportunity_bid=opportunity_bid,
    )

    return opportunity_bid_info
