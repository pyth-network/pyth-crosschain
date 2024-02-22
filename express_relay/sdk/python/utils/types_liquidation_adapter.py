from typing import TypedDict


class TokenQty(TypedDict):
    contract: str
    amount: str


class LiquidationOpportunity(TypedDict):
    # The unique id of the opportunity
    opportunity_id: str
    # The id of the chain where the opportunity was found
    chain_id: str
    # Address of the contract where the liquidation method is called
    contract: str
    # The calldata that needs to be passed in with the liquidation method call
    calldata: str
    # The value that needs to be passed in with the liquidation method call
    value: str
    # The permission key necessary to call the liquidation method
    permission_key: str
    # A list of tokens that can be used to repay this account's debt. Each entry in the list is a tuple (token address, hex string of repay amount)
    repay_tokens: list[TokenQty]
    # A list of tokens that ought to be received by the liquidator in exchange for the repay tokens. Each entry in the list is a tuple (token address, hex string of receipt amount)
    receipt_tokens: list[TokenQty]
    # Opportunity format version, used to determine how to interpret the opportunity data
    version: str


class LiquidationAdapterCalldata(TypedDict):
    repay_tokens: list[(str, int)]
    expected_receipt_tokens: list[(str, int)]
    liquidator: str
    contract: str
    data: bytes
    valid_until: int
    bid: int
    signature_liquidator: bytes


class LiquidationAdapterTransaction(TypedDict):
    bid: str
    calldata: str
    chain_id: str
    contract: str
    permission_key: str
