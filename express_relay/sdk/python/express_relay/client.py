import asyncio
import json
import urllib.parse
from asyncio import Task
from collections.abc import Coroutine
from datetime import datetime
from typing import Callable, Any, Union, cast
from uuid import UUID

import httpx
import web3
import websockets
from eth_abi import encode
from eth_account.account import Account
from eth_account.datastructures import SignedMessage
from eth_utils import to_checksum_address
from hexbytes import HexBytes
from solders.instruction import Instruction
from solders.pubkey import Pubkey
from solders.sysvar import INSTRUCTIONS
from websockets.client import WebSocketClientProtocol

from express_relay.constants import (
    OPPORTUNITY_ADAPTER_CONFIGS,
    EXECUTION_PARAMS_TYPESTRING,
    SVM_CONFIGS,
)
from express_relay.express_relay_types import (
    BidResponse,
    Opportunity,
    BidStatusUpdate,
    ClientMessage,
    Bid,
    OpportunityBid,
    OpportunityParams,
    Address,
    Bytes32,
    TokenAmount,
    OpportunityBidParams,
    BidEvm,
    OpportunityRoot,
    OpportunityEvm,
)
from express_relay.svm.generated.express_relay.instructions import submit_bid
from express_relay.svm.generated.express_relay.program_id import (
    PROGRAM_ID as SVM_EXPRESS_RELAY_PROGRAM_ID,
)
from express_relay.svm.generated.express_relay.types import SubmitBidArgs
from express_relay.svm.limo_client import LimoClient


def _get_permitted_tokens(
    sell_tokens: list[TokenAmount],
    bid_amount: int,
    call_value: int,
    weth_address: Address,
) -> list[dict[str, Union[str, int]]]:
    """
    Extracts the sell tokens in the permit format.

    Args:
        sell_tokens: A list of TokenAmount objects representing the sell tokens.
        bid_amount: An integer representing the amount of the bid (in wei).
        call_value: An integer representing the call value of the bid (in wei).
        weth_address: The address of the WETH token.
    Returns:
        A list of dictionaries representing the sell tokens in the permit format.
    """
    permitted_tokens: list[dict[str, Union[str, int]]] = [
        {
            "token": token.token,
            "amount": int(token.amount),
        }
        for token in sell_tokens
    ]

    for token in permitted_tokens:
        if token["token"] == weth_address:
            sell_token_amount = cast(int, token["amount"])
            token["amount"] = sell_token_amount + call_value + bid_amount
            return permitted_tokens

    if bid_amount + call_value > 0:
        permitted_tokens.append(
            {
                "token": weth_address,
                "amount": bid_amount + call_value,
            }
        )

    return permitted_tokens


class ExpressRelayClientException(Exception):
    pass


class ExpressRelayClient:
    def __init__(
        self,
        server_url: str,
        api_key: str | None = None,
        opportunity_callback: (
            Callable[[Opportunity], Coroutine[Any, Any, Any]] | None
        ) = None,
        bid_status_callback: (
            Callable[[BidStatusUpdate], Coroutine[Any, Any, Any]] | None
        ) = None,
        timeout_response_secs: int = 10,
        ws_options: dict[str, Any] | None = None,
        http_options: dict[str, Any] | None = None,
    ):
        """
        Args:
            server_url: The URL of the auction server.
            opportunity_callback: An async function that serves as the callback on a new opportunity. Should take in one external argument of type Opportunity.
            bid_status_callback: An async function that serves as the callback on a new bid status update. Should take in one external argument of type BidStatusUpdate.
            timeout_response_secs: The number of seconds to wait for a response message from the server.
            ws_options: Keyword arguments to pass to the websocket connection.
            http_options: Keyword arguments to pass to the HTTP client.
        """
        parsed_url = urllib.parse.urlparse(server_url)
        if parsed_url.scheme == "https":
            ws_scheme = "wss"
        elif parsed_url.scheme == "http":
            ws_scheme = "ws"
        else:
            raise ValueError("Invalid server URL")

        self.server_url = server_url
        self.api_key = api_key
        self.ws_endpoint = parsed_url._replace(scheme=ws_scheme, path="/v1/ws").geturl()
        self.ws_msg_counter = 0
        self.ws: WebSocketClientProtocol
        self.ws_lock = asyncio.Lock()
        self.ws_loop: Task[Any]
        self.ws_msg_futures: dict[str, asyncio.Future] = {}
        self.timeout_response_secs = timeout_response_secs
        if ws_options is None:
            ws_options = {}
        self.ws_options = ws_options
        if http_options is None:
            http_options = {}
        self.http_options = http_options
        self.opportunity_callback = opportunity_callback
        self.bid_status_callback = bid_status_callback
        if self.api_key:
            authorization_header = f"Bearer {self.api_key}"
            if "headers" not in self.http_options:
                self.http_options["headers"] = {}
            self.http_options["headers"]["Authorization"] = authorization_header
            if "extra_headers" not in self.ws_options:
                self.ws_options["extra_headers"] = {}
            self.ws_options["extra_headers"]["Authorization"] = authorization_header

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

    def convert_client_msg_to_server(self, client_msg: ClientMessage) -> dict:
        """
        Converts the params of a ClientMessage model dict to the format expected by the server.

        Args:
            client_msg: The message to send to the server.
        Returns:
            The message as a dict with the params converted to the format expected by the server.
        """
        msg = client_msg.model_dump()
        method = msg["params"]["method"]
        msg["id"] = str(self.ws_msg_counter)
        self.ws_msg_counter += 1

        if method == "post_bid":
            msg["params"] = {"bid": msg["params"]}

        msg["method"] = method

        return msg

    async def send_ws_msg(self, client_msg: ClientMessage) -> dict:
        """
        Sends a message to the server via websocket.

        Args:
            client_msg: The message to send.
        Returns:
            The result of the response message from the server.
        """
        await self.start_ws()

        msg = self.convert_client_msg_to_server(client_msg)

        future = asyncio.get_event_loop().create_future()
        self.ws_msg_futures[msg["id"]] = future

        await self.ws.send(json.dumps(msg))

        # await the response for the sent ws message from the server
        msg_response = await asyncio.wait_for(
            future, timeout=self.timeout_response_secs
        )

        return self.process_response_msg(msg_response)

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
            "method": "subscribe",
            "chain_ids": chain_ids,
        }
        client_msg = ClientMessage.model_validate({"params": params})
        await self.send_ws_msg(client_msg)

    async def unsubscribe_chains(self, chain_ids: list[str]):
        """
        Unsubscribes websocket from a list of chain IDs for new opportunities.

        Args:
            chain_ids: A list of chain IDs to unsubscribe from.
        """
        params = {
            "method": "unsubscribe",
            "chain_ids": chain_ids,
        }
        client_msg = ClientMessage.model_validate({"params": params})
        await self.send_ws_msg(client_msg)

    async def submit_bid(self, bid: Bid, subscribe_to_updates: bool = True) -> UUID:
        """
        Submits a bid to the auction server.

        Args:
            bid: An object representing the bid to submit.
            subscribe_to_updates: A boolean indicating whether to subscribe to the bid status updates.
        Returns:
            The ID of the submitted bid.
        """
        bid_dict = bid.model_dump()
        if subscribe_to_updates:
            bid_dict["method"] = "post_bid"
            client_msg = ClientMessage.model_validate({"params": bid_dict})
            result = await self.send_ws_msg(client_msg)
            bid_id = UUID(result.get("id"))
        else:
            async with httpx.AsyncClient(**self.http_options) as client:
                resp = await client.post(
                    urllib.parse.urlparse(self.server_url)
                    ._replace(path="/v1/bids")
                    .geturl(),
                    json=bid_dict,
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
                        opportunity = OpportunityRoot.model_validate(
                            msg_json["opportunity"]
                        )
                        if opportunity:
                            asyncio.create_task(opportunity_callback(opportunity.root))

                elif msg_json.get("type") == "bid_status_update":
                    if bid_status_callback is not None:
                        bid_status_update = BidStatusUpdate.process_bid_status_dict(
                            msg_json["status"]
                        )
                        if bid_status_update:
                            asyncio.create_task(bid_status_callback(bid_status_update))

            elif msg_json.get("id"):
                future = self.ws_msg_futures.pop(msg_json["id"])
                future.set_result(msg_json)

    async def get_opportunities(self, chain_id: str | None = None) -> list[Opportunity]:
        """
        Connects to the server and fetches opportunities.

        Args:
            chain_id: The chain ID to fetch opportunities for. If None, fetches opportunities across all chains.
        Returns:
            A list of opportunities.
        """
        params = {}
        if chain_id:
            params["chain_id"] = chain_id

        async with httpx.AsyncClient(**self.http_options) as client:
            resp = await client.get(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/opportunities")
                .geturl(),
                params=params,
            )

        resp.raise_for_status()

        opportunities: list[Opportunity] = []
        for opportunity in resp.json():
            opportunity_processed = OpportunityRoot.model_validate(opportunity)
            if opportunity_processed:
                opportunities.append(opportunity_processed.root)

        return opportunities

    async def submit_opportunity(self, opportunity: OpportunityParams) -> UUID:
        """
        Submits an opportunity to the server.

        Args:
            opportunity: An object representing the opportunity to submit.
        Returns:
            The ID of the submitted opportunity.
        """
        async with httpx.AsyncClient(**self.http_options) as client:
            resp = await client.post(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/opportunities")
                .geturl(),
                json=opportunity.params.model_dump(),
            )
        resp.raise_for_status()
        return UUID(resp.json()["opportunity_id"])

    async def get_bids(self, from_time: datetime | None = None) -> list[BidResponse]:
        """
        Fetches bids for an api key from the server with pagination of 20 bids per page.

        Args:
            from_time: The datetime to fetch bids from. If None, fetches from the beginning of time.
        Returns:
            A list of bids.
        """
        async with httpx.AsyncClient(**self.http_options) as client:
            resp = await client.get(
                urllib.parse.urlparse(self.server_url)
                ._replace(path="/v1/bids")
                .geturl(),
                params=(
                    {"from_time": from_time.astimezone().isoformat()}
                    if from_time
                    else None
                ),
            )

        resp.raise_for_status()

        bids = []
        for bid in resp.json()["items"]:
            bid_processed = BidResponse.process_bid_response_dict(bid)
            if bid_processed:
                bids.append(bid_processed)

        return bids

    @staticmethod
    def get_svm_submit_bid_instruction(
        searcher: Pubkey,
        router: Pubkey,
        permission_key: Pubkey,
        bid_amount: int,
        deadline: int,
        chain_id: str,
        fee_receiver_relayer: Pubkey,
        relayer_signer: Pubkey,
    ) -> Instruction:
        if chain_id not in SVM_CONFIGS:
            raise ValueError(f"Chain ID {chain_id} not supported")
        svm_config = SVM_CONFIGS[chain_id]
        config_router = LimoClient.get_express_relay_config_router_pda(
            SVM_EXPRESS_RELAY_PROGRAM_ID, router
        )
        express_relay_metadata = LimoClient.get_express_relay_metadata_pda(
            SVM_EXPRESS_RELAY_PROGRAM_ID
        )
        submit_bid_ix = submit_bid(
            {"data": SubmitBidArgs(deadline=deadline, bid_amount=bid_amount)},
            {
                "searcher": searcher,
                "relayer_signer": relayer_signer,
                "permission": permission_key,
                "router": router,
                "config_router": config_router,
                "express_relay_metadata": express_relay_metadata,
                "fee_receiver_relayer": fee_receiver_relayer,
                "sysvar_instructions": INSTRUCTIONS,
            },
            svm_config["express_relay_program"],
        )
        return submit_bid_ix


def compute_create2_address(
    searcher_address: Address,
    opportunity_adapter_factory_address: Address,
    opportunity_adapter_init_bytecode_hash: Bytes32,
) -> Address:
    """
    Computes the CREATE2 address for the opportunity adapter belonging to the searcher.

    Args:
        searcher_address: The address of the searcher's wallet.
        opportunity_adapter_factory_address: The address of the opportunity adapter factory.
        opportunity_adapter_init_bytecode_hash: The hash of the init code for the opportunity adapter.
    Returns:
        The computed CREATE2 address for the opportunity adapter.
    """
    pre = b"\xff"
    opportunity_adapter_factory = bytes.fromhex(
        opportunity_adapter_factory_address.replace("0x", "")
    )
    wallet = bytes.fromhex(searcher_address.replace("0x", ""))
    salt = bytes(12) + wallet
    init_code_hash = bytes.fromhex(
        opportunity_adapter_init_bytecode_hash.replace("0x", "")
    )
    result = web3.Web3.keccak(pre + opportunity_adapter_factory + salt + init_code_hash)
    return to_checksum_address(result[12:].hex())


def make_adapter_calldata(
    opportunity: OpportunityEvm,
    permitted: list[dict[str, Union[str, int]]],
    executor: Address,
    bid_params: OpportunityBidParams,
    signature: HexBytes,
):
    """
    Constructs the calldata for the opportunity adapter contract.

    Args:
        opportunity: An object representing the opportunity, of type Opportunity.
        permitted: A list of dictionaries representing the permitted tokens, in the format outputted by _get_permitted_tokens.
        executor: The address of the searcher's wallet.
        bid_params: An object representing the bid parameters, of type OpportunityBidParams.
        signature: The signature of the searcher's bid, as a HexBytes object.
    """
    function_selector = web3.Web3.solidity_keccak(
        ["string"], [f"executeOpportunity({EXECUTION_PARAMS_TYPESTRING},bytes)"]
    )[:4]
    function_args = encode(
        [EXECUTION_PARAMS_TYPESTRING, "bytes"],
        [
            (
                (
                    [(token["token"], token["amount"]) for token in permitted],
                    bid_params.nonce,
                    bid_params.deadline,
                ),
                (
                    [(token.token, token.amount) for token in opportunity.buy_tokens],
                    executor,
                    opportunity.target_contract,
                    bytes.fromhex(opportunity.target_calldata.replace("0x", "")),
                    opportunity.target_call_value,
                    bid_params.amount,
                ),
            ),
            signature,
        ],
    )
    calldata = f"0x{(function_selector + function_args).hex().replace('0x', '')}"
    return calldata


def get_opportunity_adapter_config(chain_id: str):
    opportunity_adapter_config = OPPORTUNITY_ADAPTER_CONFIGS.get(chain_id)
    if not opportunity_adapter_config:
        raise ExpressRelayClientException(
            f"Opportunity adapter config not found for chain id {chain_id}"
        )
    return opportunity_adapter_config


def get_signature(
    opportunity: OpportunityEvm,
    bid_params: OpportunityBidParams,
    private_key: str,
) -> SignedMessage:
    """
    Constructs a signature for a searcher's bid and opportunity.

    Args:
        opportunity: An object representing the opportunity, of type Opportunity.
        bid_params: An object representing the bid parameters, of type OpportunityBidParams.
        private_key: A 0x-prefixed hex string representing the searcher's private key.
    Returns:
        A SignedMessage object, representing the signature of the searcher's bid.
    """
    opportunity_adapter_config = get_opportunity_adapter_config(opportunity.chain_id)
    domain_data = {
        "name": "Permit2",
        "chainId": opportunity_adapter_config.chain_id,
        "verifyingContract": opportunity_adapter_config.permit2,
    }

    executor = Account.from_key(private_key).address
    message_types = {
        "PermitBatchWitnessTransferFrom": [
            {"name": "permitted", "type": "TokenPermissions[]"},
            {"name": "spender", "type": "address"},
            {"name": "nonce", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
            {"name": "witness", "type": "OpportunityWitness"},
        ],
        "OpportunityWitness": [
            {"name": "buyTokens", "type": "TokenAmount[]"},
            {"name": "executor", "type": "address"},
            {"name": "targetContract", "type": "address"},
            {"name": "targetCalldata", "type": "bytes"},
            {"name": "targetCallValue", "type": "uint256"},
            {"name": "bidAmount", "type": "uint256"},
        ],
        "TokenAmount": [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "TokenPermissions": [
            {"name": "token", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
    }

    permitted = _get_permitted_tokens(
        opportunity.sell_tokens,
        bid_params.amount,
        opportunity.target_call_value,
        opportunity_adapter_config.weth,
    )

    # the data to be signed
    message_data = {
        "permitted": permitted,
        "spender": compute_create2_address(
            executor,
            opportunity_adapter_config.opportunity_adapter_factory,
            opportunity_adapter_config.opportunity_adapter_init_bytecode_hash,
        ),
        "nonce": bid_params.nonce,
        "deadline": bid_params.deadline,
        "witness": {
            "buyTokens": [
                {
                    "token": token.token,
                    "amount": int(token.amount),
                }
                for token in opportunity.buy_tokens
            ],
            "executor": executor,
            "targetContract": opportunity.target_contract,
            "targetCalldata": bytes.fromhex(
                opportunity.target_calldata.replace("0x", "")
            ),
            "targetCallValue": opportunity.target_call_value,
            "bidAmount": bid_params.amount,
        },
    }

    signed_typed_data = Account.sign_typed_data(
        private_key, domain_data, message_types, message_data
    )

    return signed_typed_data


def sign_opportunity_bid(
    opportunity: OpportunityEvm,
    bid_params: OpportunityBidParams,
    private_key: str,
) -> OpportunityBid:
    """
    Constructs a signature for a searcher's bid and returns the OpportunityBid object to be submitted to the server.

    Args:
        opportunity: An object representing the opportunity, of type Opportunity.
        bid_params: An object representing the bid parameters, of type OpportunityBidParams.
        private_key: A 0x-prefixed hex string representing the searcher's private key.
    Returns:
        A OpportunityBid object, representing the transaction to submit to the server. This object contains the searcher's signature.
    """
    executor = Account.from_key(private_key).address
    opportunity_bid = OpportunityBid(
        opportunity_id=opportunity.opportunity_id,
        permission_key=opportunity.permission_key,
        amount=bid_params.amount,
        deadline=bid_params.deadline,
        nonce=bid_params.nonce,
        executor=executor,
        signature=get_signature(opportunity, bid_params, private_key),
    )

    return opportunity_bid


def sign_bid(
    opportunity: OpportunityEvm, bid_params: OpportunityBidParams, private_key: str
) -> BidEvm:
    """
    Constructs a signature for a searcher's bid and returns the Bid object to be submitted to the server.

    Args:
        opportunity: An object representing the opportunity, of type Opportunity.
        bid_params: An object representing the bid parameters, of type OpportunityBidParams.
        private_key: A 0x-prefixed hex string representing the searcher's private key.
    Returns:
        A Bid object, representing the transaction to submit to the server. This object contains the searcher's signature.
    """
    opportunity_adapter_config = get_opportunity_adapter_config(opportunity.chain_id)
    permitted = _get_permitted_tokens(
        opportunity.sell_tokens,
        bid_params.amount,
        opportunity.target_call_value,
        opportunity_adapter_config.weth,
    )
    executor = Account.from_key(private_key).address

    signature = get_signature(opportunity, bid_params, private_key).signature
    calldata = make_adapter_calldata(
        opportunity, permitted, executor, bid_params, signature
    )

    return BidEvm(
        amount=bid_params.amount,
        target_calldata=calldata,
        chain_id=opportunity.chain_id,
        target_contract=opportunity_adapter_config.opportunity_adapter_factory,
        permission_key=opportunity.permission_key,
    )
