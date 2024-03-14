import asyncio
from asyncio import Task
import json
import urllib.parse
from typing import Callable, Any
from collections.abc import Coroutine
from uuid import UUID
import httpx
import web3
import websockets
from websockets.client import WebSocketClientProtocol
from eth_abi import encode
from eth_account.account import Account
from web3.auto import w3
from express_relay_utils.express_relay_types import (
    Opportunity,
    BidStatusUpdate,
    ClientMessage,
    BidStatus,
    Bid,
    OpportunityBid,
    OpportunityParams,
)


class ExpressRelayClientException(Exception):
    pass


class ExpressRelayClient:
    def __init__(
        self,
        server_url: str,
        opportunity_callback: (
            Callable[[Opportunity], Coroutine[Any, Any, Any]] | None
        ) = None,
        bid_status_callback: (
            Callable[[BidStatusUpdate], Coroutine[Any, Any, Any]] | None
        ) = None,
        **kwargs,
    ):
        """
        Args:
            server_url: The URL of the auction server.
            opportunity_callback: An async function that serves as the callback on a new opportunity. Should take in one external argument of type Opportunity.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatusUpdate.
            kwargs: Keyword arguments to pass to the websocket connection.
        """
        parsed_url = urllib.parse.urlparse(server_url)
        if parsed_url.scheme == "https":
            ws_scheme = "wss"
        elif parsed_url.scheme == "http":
            ws_scheme = "ws"
        else:
            raise ValueError("Invalid server URL")

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

        params.update({"method": method})

        # validate the format of msg and construct the message dict to send
        client_msg_validated = ClientMessage.model_validate({"params": params})
        msg = client_msg_validated.convert_to_server()
        msg["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        future = asyncio.get_event_loop().create_future()
        self.ws_msg_futures[msg["id"]] = future

        await self.ws.send(json.dumps(msg))

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
        Subscribes websocket to a list of chain IDs for new opportunities.

        Args:
            chain_ids: A list of chain IDs to subscribe to.
        """
        params = {
            "chain_ids": chain_ids,
        }
        await self.send_ws_message("subscribe", params)

    async def unsubscribe_chains(self, chain_ids: list[str]):
        """
        Unsubscribes websocket from a list of chain IDs for new opportunities.

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
            bid: An object representing the bid to submit.
            subscribe_to_updates: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        bid_dict = bid.model_dump()
        if subscribe_to_updates:
            result = await self.send_ws_message("post_bid", bid_dict)
            bid_id = UUID(result.get("id"))
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(path="/v1/bids")
                    .geturl(),
                    json=bid_dict,
                    **kwargs,
                )

            resp.raise_for_status()
            bid_id = UUID(resp.json().get("id"))

        return bid_id

    async def submit_opportunity_bid(
        self,
        opportunity_bid: OpportunityBid,
        subscribe_to_updates: bool = True,
        **kwargs,
    ) -> UUID:
        """
        Submits a bid on an opportunity to the server via websocket.

        Args:
            opportunity_bid: An object representing the bid to submit on an opportunity.
            subscribe_to_updates: A boolean indicating whether to subscribe to the bid status updates.
            kwargs: Keyword arguments to pass to the HTTP post request.
        Returns:
            The ID of the submitted bid.
        """
        opportunity_bid_dict = opportunity_bid.model_dump()
        if subscribe_to_updates:
            result = await self.send_ws_message(
                "post_opportunity_bid",
                {
                    "opportunity_id": opportunity_bid.opportunity_id,
                    "amount": opportunity_bid.amount,
                    "executor": opportunity_bid.executor,
                    "permission_key": opportunity_bid.permission_key,
                    "signature": opportunity_bid.signature,
                    "valid_until": opportunity_bid.valid_until,
                },
            )
            bid_id = UUID(result.get("id"))
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(
                        path=f"/v1/opportunities/{opportunity_bid.opportunity_id}/bids"
                    )
                    .geturl(),
                    json=opportunity_bid_dict,
                    **kwargs,
                )

            resp.raise_for_status()
            bid_id = UUID(resp.json().get("id"))

        return bid_id

    async def ws_handler(
        self,
        opportunity_callback: (
            Callable[[Opportunity], Coroutine[Any, Any, Any]] | None
        ) = None,
        bid_status_callback: (
            Callable[[BidStatusUpdate], Coroutine[Any, Any, Any]] | None
        ) = None,
    ):
        """
        Continually handles new ws messages as they are received from the server via websocket.

        Args:
            opportunity_callback: An async function that serves as the callback on a new opportunity. Should take in one external argument of type Opportunity.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatusUpdate.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket not connected")

        async for msg in self.ws:
            msg_json = json.loads(msg)

            if msg_json.get("type"):
                if msg_json.get("type") == "new_opportunity":
                    if opportunity_callback is not None:
                        opportunity = Opportunity.model_validate(
                            msg_json.get("opportunity")
                        )
                        if opportunity:
                            asyncio.create_task(opportunity_callback(opportunity))

                elif msg_json.get("type") == "bid_status_update":
                    if bid_status_callback is not None:
                        id = msg_json.get("status").get("id")
                        bid_status = (
                            msg_json.get("status").get("bid_status").get("status")
                        )
                        result = msg_json.get("status").get("bid_status").get("result")
                        bid_status_update = BidStatusUpdate(
                            id=id, bid_status=BidStatus(bid_status), result=result
                        )
                        asyncio.create_task(bid_status_callback(bid_status_update))

            elif msg_json.get("id"):
                future = self.ws_msg_futures.pop(msg_json["id"])
                future.set_result(msg_json)

    async def get_opportunities(
        self, chain_id: str | None = None, timeout_secs: int = 10
    ) -> list[Opportunity]:
        """
        Connects to the server and fetches opportunities.

        Args:
            chain_id: The chain ID to fetch opportunities for. If None, fetches opportunities across all chains.
            timeout_secs: The timeout for the HTTP request in seconds.
        Returns:
            A list of opportunities.
        """
        params = {}
        if chain_id:
            params["chain_id"] = chain_id

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/opportunities")
                .geturl(),
                params=params,
                timeout=timeout_secs,
            )

        resp.raise_for_status()

        opportunities = [
            Opportunity.model_validate(opportunity) for opportunity in resp.json()
        ]

        return opportunities

    async def submit_opportunity(
        self, opportunity: OpportunityParams, timeout_secs: int = 10
    ) -> UUID:
        """
        Submits an opportunity to the server.

        Args:
            opportunity: An object representing the opportunity to submit.
            timeout_secs: The timeout for the HTTP request in seconds.
        Returns:
            The ID of the submitted opportunity.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/opportunities")
                .geturl(),
                json=opportunity.params.model_dump(),
                timeout=timeout_secs,
            )
        resp.raise_for_status()
        return UUID(resp.json()["opportunity_id"])


def sign_bid(
    opportunity: Opportunity,
    bid_amount: int,
    valid_until: int,
    private_key: str,
) -> OpportunityBid:
    """
    Constructs a signature for a searcher's bid and returns the OpportunityBid object to be submitted to the server.

    Args:
        opportunity: An object representing the opportunity, of type Opportunity.
        bid_amount: An integer representing the amount of the bid (in wei).
        valid_until: An integer representing the unix timestamp until which the bid is valid.
        private_key: A 0x-prefixed hex string representing the searcher's private key.
    Returns:
        A OpportunityBid object, representing the transaction to submit to the server. This object contains the searcher's signature.
    """
    sell_tokens = [
        (token.token, int(token.amount)) for token in opportunity.sell_tokens
    ]
    buy_tokens = [(token.token, int(token.amount)) for token in opportunity.buy_tokens]
    target_calldata = bytes.fromhex(opportunity.target_calldata.replace("0x", ""))

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
            sell_tokens,
            buy_tokens,
            opportunity.target_contract,
            target_calldata,
            opportunity.target_call_value,
            bid_amount,
            valid_until,
        ],
    )
    msg_data = web3.Web3.solidity_keccak(["bytes"], [digest])
    signature = w3.eth.account.signHash(msg_data, private_key=private_key)

    opportunity_bid = OpportunityBid(
        opportunity_id=opportunity.opportunity_id,
        permission_key=opportunity.permission_key,
        amount=bid_amount,
        valid_until=valid_until,
        executor=Account.from_key(private_key).address,
        signature=signature,
    )

    return opportunity_bid
