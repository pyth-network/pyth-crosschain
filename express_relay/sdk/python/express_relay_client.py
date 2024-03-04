import web3
from eth_abi import encode
from eth_account.account import Account
from web3.auto import w3
import httpx
import urllib.parse
import websockets
import json
from typing import Callable
import asyncio

from openapi_client.models.opportunity_bid import OpportunityBid
from openapi_client.models.opportunity_params import OpportunityParams
from openapi_client.models.opportunity_params_with_metadata import OpportunityParamsWithMetadata

class BidInfo:
    def __init__(self, opportunity_id: str, opportunity_bid: OpportunityBid):
        self.opportunity_id = opportunity_id
        self.opportunity_bid = opportunity_bid

class WebsocketTimeoutConfig:
    """
    A class to hold the timeout configuration for the websocket connection.

    Args:
        open_timeout (int): The timeout for opening the websocket connection.
        ping_interval (int): The interval at which to send ping messages to the server.
        ping_timeout (int): The timeout for the ping messages.
        close_timeout (int): The timeout for closing the websocket connection.
    """
    def __init__(self, open_timeout: int = 10, ping_interval: int = 20, ping_timeout: int = 20, close_timeout: int = 10):
        self.open_timeout = open_timeout
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.close_timeout = close_timeout

class ExpressRelayClientException(Exception):
    pass

class ExpressRelayClient:
    def __init__(self, server_url: str):
        self.server_url = server_url
        if self.server_url.startswith("https"):
            self.ws_endpoint = urllib.parse.urljoin(f"wss{self.server_url[5:]}", "v1/ws")
        elif self.server_url.startswith("http"):
            self.ws_endpoint = urllib.parse.urljoin(f"ws{self.server_url[4:]}", "v1/ws")
        else:
            raise ValueError("Invalid liquidation server URL")
        self.ws_msg_counter = 0
        self.ws = False

    async def start_ws(self, ws_timeout_config: WebsocketTimeoutConfig = WebsocketTimeoutConfig()):
        """
        Initializes the websocket connection to the server.

        Args:
            ws_timeout_config (WebsocketTimeoutConfig): The timeout configuration for the websocket connection.
        """
        self.ws = await websockets.connect(self.ws_endpoint, open_timeout=ws_timeout_config.open_timeout, ping_interval=ws_timeout_config.ping_interval, ping_timeout=ws_timeout_config.ping_timeout, close_timeout=ws_timeout_config.close_timeout)

    async def close_ws(self):
        """
        Closes the websocket connection to the server.
        """
        await self.ws.close()

    async def get_liquidation_opportunities(self, chain_id: str, timeout: int = 10) -> list[OpportunityParamsWithMetadata]:
        """
        Connects to the liquidation server and fetches liquidation opportunities for a given chain ID.

        Args:
            chain_id (str): The chain ID to fetch liquidation opportunities for.
            timeout (int): The timeout for the HTTP request.
        Returns:
            list[OpportunityParamsWithMetadata]: A list of liquidation opportunities.
        """
        async with httpx.AsyncClient() as client:
            resp = (
                await client.get(
                    urllib.parse.urljoin(
                        self.server_url, "/v1/liquidation/opportunities"
                    ),
                    params={"chain_id": chain_id},
                    timeout=timeout,
                )
            )

        resp.raise_for_status()

        opportunities = [OpportunityParamsWithMetadata.from_dict(opportunity) for opportunity in resp.json()]

        return opportunities

    async def subscribe_chain_ids(self, chain_ids: list[str]):
        """
        Subscribes to a list of chain IDs for new liquidation opportunities.

        Args:
            chain_ids (list[str]): A list of chain IDs to subscribe to.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket connection not yet open")

        json_subscribe = {
            "method": "subscribe",
            "params": {
                "chain_ids": chain_ids,
            },
            "id": str(self.ws_msg_counter),
        }
        await self.ws.send(json.dumps(json_subscribe))
        self.ws_msg_counter += 1

    async def unsubscribe_chain_ids(self, chain_ids: str):
        if not self.ws:
            raise ExpressRelayClientException("Websocket connection not yet open")

        json_subscribe = {
            "method": "unsubscribe",
            "params": {
                "chain_ids": chain_ids,
            },
            "id": str(self.ws_msg_counter),
        }
        await self.ws.send(json.dumps(json_subscribe))
        self.ws_msg_counter += 1

    async def ws_liquidation_opportunities(self, opportunity_handler: Callable[[OpportunityParamsWithMetadata], None]):
        """
        Connects to the liquidation server's websocket and handles new liquidation opportunities.

        Args:
            opportunity_handler (async func): An async function that defines how to handle new liquidation opportunities. Should take in one external argument of type OpportunityParamsWithMetadata and return nothing.
        """
        if not self.ws:
            raise ExpressRelayClientException("Websocket connection not yet open")

        while True:
            msg = json.loads(await self.ws.recv())
            status = msg.get("status")
            if status and status != "success":
                raise ExpressRelayClientException(f"Error in websocket subscription: {msg.get('result')}")

            if msg.get("type") != "new_opportunity":
                continue

            opportunity = msg["opportunity"]
            opportunity = OpportunityParamsWithMetadata.from_dict(opportunity)
            try:
                await opportunity_handler(opportunity)
            except Exception as e:
                raise ExpressRelayClientException(f"Error in opportunity handler: {e}")

    async def submit_opportunity(self, opportunity: OpportunityParams, timeout: int = 10) -> httpx.Response:
        """
        Submits an opportunity to the liquidation server.

        Args:
            opportunity (OpportunityParams): An object representing the opportunity to submit.
            timeout (int): The timeout for the HTTP request.
        Returns:
            httpx.Response: The server's response to the opportunity submission. Throws an exception if the response is not successful.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urljoin(self.server_url, "/v1/liquidation/opportunities"),
                json=opportunity.to_dict(),
                timeout=timeout,
            )

        resp.raise_for_status()

        return resp

    async def submit_bid(self, bid_info: BidInfo, timeout: int = 10) -> httpx.Response:
        """
        Submits a bid to the liquidation server.

        Args:
            bid_info (BidInfo): An object representing the bid to submit.
            timeout (int): The timeout for the HTTP request.
        Returns:
            httpx.Response: The server's response to the bid submission. Throws an exception if the response is not successful.
        """
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                urllib.parse.urljoin(
                    self.server_url,
                    f"/v1/liquidation/opportunities/{bid_info.opportunity_id}/bids",
                ),
                json=bid_info.opportunity_bid.to_dict(),
                timeout=timeout,
            )

        resp.raise_for_status()

        return resp

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
        private_key: A string representing the liquidator's private key.
    Returns:
        A BidInfo object, representing the transaction to submit to the liquidation server. This object contains the liquidator's signature.
    """
    repay_tokens = [(token.contract, int(token.amount)) for token in liquidation_opportunity.repay_tokens]
    receipt_tokens = [(token.contract, int(token.amount)) for token in liquidation_opportunity.receipt_tokens]
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
