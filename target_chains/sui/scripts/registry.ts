export const REGISTRY =
{
    DEVNET: {
        "PYTH_PACKAGE_ID": "0x0",
        "PYTH_STATE_ID": "0x0",
        "WORMHOLE_PACKAGE_ID": "0x07aa529a7ab00007b9081f47728537d47d7fe0f3d7fded2c01fa34340ac7a71c",
        "WORMHOLE_STATE_ID": "0x14cbf165349ad2934c8819f307e973c03d08ffe3a40548068298aeffa8a93bbf",
        "RPC_URL": "http://0.0.0.0:9000"
    },
    TESTNET: {
        "PYTH_PACKAGE_ID": "0x0",
        "PYTH_STATE_ID": "0x0",
        "WORMHOLE_PACKAGE_ID": "0x0",
        "WORMHOLE_STATE_ID": "0x0",
        "RPC_URL": "https://fullnode.testnet.sui.io:443"
    },
    MAINNET: {
        "PYTH_PACKAGE_ID": "0x0",
        "PYTH_STATE_ID": "0x0",
        "WORMHOLE_PACKAGE_ID": "0x0",
        "WORMHOLE_STATE_ID": "0x0",
        "RPC_URL": "https://fullnode.mainnet.sui.io:443"
    }
}

export enum NETWORK {
    DEVNET = "DEVNET",
    TESTNET = "TESTNET",
    MAINNET = "MAINNET",
}
