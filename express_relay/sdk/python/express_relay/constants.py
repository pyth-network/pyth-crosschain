from express_relay.express_relay_types import OpportunityAdapterConfig

OPPORTUNITY_ADAPTER_CONFIGS = {
    "development": OpportunityAdapterConfig(
        chain_id=31337,
        opportunity_adapter_factory="0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
        opportunity_adapter_init_bytecode_hash="0xd53b8e32ab2ecba07c3e3a17c3c5e492c62e2f7051b89e5154f52e6bfeb0e38f",
        permit2="0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
        weth="0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    ),
    "op_sepolia": OpportunityAdapterConfig(
        chain_id=11155420,
        opportunity_adapter_factory="0xfA119693864b2F185742A409c66f04865c787754",
        opportunity_adapter_init_bytecode_hash="0x3d71516d94b96a8fdca4e3a5825a6b41c9268a8e94610367e69a8462cc543533",
        permit2="0x000000000022D473030F116dDEE9F6B43aC78BA3",
        weth="0x74A4A85C611679B73F402B36c0F84A7D2CcdFDa3",
    ),
}

PERMIT_BATCH_TRANSFER_FROM_TYPESTRING = "((address,uint256)[],uint256,uint256)"
EXECUTION_WITNESS_TYPESTRING = (
    "((address,uint256)[],address,address,bytes,uint256,uint256)"
)
EXECUTION_PARAMS_TYPESTRING = (
    f"({PERMIT_BATCH_TRANSFER_FROM_TYPESTRING},{EXECUTION_WITNESS_TYPESTRING})"
)
