import asyncio
from asyncio import Task
import json
import urllib.parse
from typing import Callable, Any
from collections.abc import Coroutine

import httpx
import web3
import websockets
from websockets.client import WebSocketClientProtocol
from eth_abi import encode
from eth_account.account import Account

from web3.auto import w3

from express_relay_types import *


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
        self.ws: WebSocketClientProtocol
        self.ws_lock = asyncio.Lock()
        self.ws_loop: Task[Any]
        self.ws_msg_futures: dict[str, asyncio.Future] = {}
        self.ws_options = kwargs
        self.opportunity_callback = opportunity_callback
        self.bid_status_callback = bid_status_callback

    async def start_ws(self):
        """
        Initializes the websocket connection to the server, if not already connected.
        """
        async with self.ws_lock:
            if not hasattr(self, "ws"):
                self.ws = await websockets.connect(self.ws_endpoint, **self.ws_options)

            if not hasattr(self, "ws_loop"):
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

    async def get_ws_loop(self) -> asyncio.Task:
        """
        Returns the websocket handler loop.
        """
        await self.start_ws()

        return self.ws_loop

    async def send_ws_message(self, method: str, params: dict) -> dict:
        """
        Sends a message to the server via websocket.

        Args:
            method: The type of message to send.
            params: The parameters to send in the message.
        Returns:
            The result of the response message from the server.
        """
        await self.start_ws()

        # validate the format of msg
        params.update({"method": method})
        msg_validated = ClientMessage.model_validate({"params": params}).to_dict()
        msg_validated["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        future = asyncio.get_event_loop().create_future()
        self.ws_msg_futures[msg_validated["id"]] = future

        await self.ws.send(json.dumps(msg_validated))

        # await the response for the sent ws message from the server
        msg = await future

        return self.process_response_msg(msg)

    def process_response_msg(self, msg: dict) -> dict:
        """
        Processes a response message received from the server via websocket.

        Args:
            msg: The message to process.
        Returns:
            The result field of the message.
        """
        if msg.get("status") and msg.get("status") != "success":
            raise ExpressRelayClientException(
                f"Error in websocket response with message id {msg.get('id')}: {msg.get('result')}"
            )
        return msg["result"]

    async def subscribe_chains(self, chain_ids: list[str]):
        """
        Subscribes websocket to a list of chain IDs for new liquidation opportunities.

        Args:
            chain_ids: A list of chain IDs to subscribe to.
        """
        params = {
            "chain_ids": chain_ids,
        }
        await self.send_ws_message("subscribe", params)

    async def unsubscribe_chains(self, chain_ids: list[str]):
        """
        Unsubscribes websocket from a list of chain IDs for new liquidation opportunities.

        Args:
            chain_ids: A list of chain IDs to unsubscribe from.
        """
        params = {
            "chain_ids": chain_ids,
        }
        await self.send_ws_message("unsubscribe", params)

    async def submit_bid(
        self, bid: Bid, subscribe_to_updates: bool = True, **kwargs
    ) -> UUID:
        """
        Submits a bid to the auction server.

        Args:
            bid_info: An object representing the bid to submit.
            subscribe_to_updates: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        if subscribe_to_updates:
            result = await self.send_ws_message("post_bid", {"bid": bid})
            bid_id = UUID(result.get("id"))
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(path="/v1/bids")
                    .geturl(),
                    json=bid.to_dict(),
                    **kwargs,
                )

            resp.raise_for_status()
            bid_id = UUID(resp.json().get("id"))

        return bid_id

    async def submit_opportunity_bid(
        self,
        opportunity_bid_info: OpportunityBidInfo,
        subscribe_to_updates: bool = True,
        **kwargs,
    ) -> UUID:
        """
        Submits a bid on an opportunity to the liquidation server via websocket.

        Args:
            opportunity_bid_info: An object representing the bid to submit on an opportunity.
            subscribe_to_updates: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        if subscribe_to_updates:
            result = await self.send_ws_message(
                "post_liquidation_bid",
                {
                    "opportunity_id": opportunity_bid_info.opportunity_id,
                    "opportunity_bid": opportunity_bid_info.opportunity_bid,
                },
            )
            bid_id = UUID(result.get("id"))
        else:
            opportunity_bid_info_dict = opportunity_bid_info.to_dict()
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

    async def ws_handler(
        self,
        opportunity_callback: (
            Callable[[OpportunityParamsWithMetadata], Coroutine[Any, Any, Any]] | None
        ) = None,
        bid_status_callback: (
            Callable[[BidStatusWithId], Coroutine[Any, Any, Any]] | None
        ) = None,
    ):
        """
        Continually handles new ws messages as they are received from the server via websocket.

        Args:
            opportunity_callback: An async function that serves as the callback on a new liquidation opportunity. Should take in one external argument of type OpportunityParamsWithMetadata.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatusWithId.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket not connected")

        async for msg in self.ws:
            msg_json = json.loads(msg)

            if msg_json.get("type"):
                if msg_json.get("type") == "new_opportunity":
                    if opportunity_callback is not None:
                        opportunity = OpportunityParamsWithMetadata.from_dict(
                            msg_json.get("opportunity")
                        )
                        asyncio.create_task(opportunity_callback(opportunity))

                elif msg_json.get("type") == "bid_status_update":
                    if bid_status_callback is not None:
                        bid_status_with_id = BidStatusWithId.from_dict(
                            msg_json.get("status")
                        )
                        asyncio.create_task(bid_status_callback(bid_status_with_id))

            elif msg_json.get("id"):
                future = self.ws_msg_futures.pop(msg_json["id"])
                future.set_result(msg_json)

    async def get_opportunities(
        self, chain_id: str | None = None, timeout_secs: int = 10
    ) -> list[OpportunityParamsWithMetadata]:
        """
        Connects to the liquidation server and fetches liquidation opportunities.

        Args:
            chain_id: The chain ID to fetch liquidation opportunities for. If None, fetches opportunities across all chains.
            timeout_secs: The timeout for the HTTP request in seconds.
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
                timeout=timeout_secs,
            )

        resp.raise_for_status()

        opportunities = [
            OpportunityParamsWithMetadata.from_dict(opportunity)
            for opportunity in resp.json()
        ]

        return opportunities

    async def submit_opportunity(
        self, opportunity: OpportunityParams, timeout_secs: int = 10
    ) -> UUID:
        """
        Submits an opportunity to the liquidation server.

        Args:
            opportunity: An object representing the opportunity to submit.
            timeout_secs: The timeout for the HTTP request in seconds.
        Returns:
            The ID of the submitted opportunity.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/liquidation/opportunities")
                .geturl(),
                json=opportunity.to_dict(),
                timeout=timeout_secs,
            )
        resp.raise_for_status()
        return UUID(resp.json()["opportunity_id"])


def sign_bid(
    liquidation_opportunity: OpportunityParamsWithMetadata,
    bid_amount: int,
    valid_until: int,
    private_key: str,
) -> OpportunityBidInfo:
    """
    Constructs a signature for a liquidator's bid and returns the OpportunityBidInfo object to be submitted to the liquidation server.

    Args:
        liquidation_opportunity: An object representing the liquidation opportunity, of type OpportunityParamsWithMetadata.
        bid_amount: An integer representing the amount of the bid (in wei).
        valid_until: An integer representing the unix timestamp until which the bid is valid.
        private_key: A 0x-prefixed hex string representing the liquidator's private key.
    Returns:
        A OpportunityBidInfo object, representing the transaction to submit to the liquidation server. This object contains the liquidator's signature.
    """
    repay_tokens = [
        (token.contract.address, int(token.amount))
        for token in liquidation_opportunity.repay_tokens
    ]
    receipt_tokens = [
        (token.contract.address, int(token.amount))
        for token in liquidation_opportunity.receipt_tokens
    ]
    calldata = bytes.fromhex(liquidation_opportunity.calldata.string.replace("0x", ""))

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
            liquidation_opportunity.contract.address,
            calldata,
            int(liquidation_opportunity.value),
            bid_amount,
            valid_until,
        ],
    )
    msg_data = web3.Web3.solidity_keccak(["bytes"], [digest])
    signature = w3.eth.account.signHash(msg_data, private_key=private_key)

    opportunity_bid_dict = {
        "permission_key": liquidation_opportunity.permission_key,
        "amount": str(bid_amount),
        "valid_until": str(valid_until),
        "liquidator": Address(address=Account.from_key(private_key).address),
        "signature": signature,
    }
    opportunity_bid = OpportunityBid.model_validate(opportunity_bid_dict)

    opportunity_bid_info = OpportunityBidInfo(
        opportunity_id=liquidation_opportunity.opportunity_id,
        opportunity_bid=opportunity_bid,
    )

    return opportunity_bid_info
