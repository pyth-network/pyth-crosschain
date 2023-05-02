export enum NETWORK {
    DEVNET = "DEVNET",
    TESTNET = "TESTNET",
    MAINNET = "MAINNET",
}

export const REGISTRY =
{
    DEVNET: {
        "PYTH_PACKAGE_ID": "0x65ff3e76bb70c3b081de7ebdbb8bc55f2072cdd1a9609a5406171f21c4f56e94",
        "PYTH_STATE_ID": "0xcb00472afd998fe551d4a4e3d492ebdaf6bbb3d6aa083f46d40c48d15871b80f",
        "WORMHOLE_PACKAGE_ID": "0x600c5bb1a273e44303f5853f83255ac3ca37f40c5696dde8584f1fd7f0449eb4",
        "WORMHOLE_STATE_ID": "0x01e2adee6591782ff86d0594d1971561a9c5a9a77fab6b27f3f25d1be4f27f07",
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

export const INITIAL_DATA_SOURCES = {
        // Devnet params are same as testnet.
        DEVNET: {
            GOVERNANCE_ADDRESS: "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
            GOVERNANCE_CHAIN: 1,
            DATA_SOURCE_ADDRESSES: ["f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0", "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6"],
            DATA_SOURCE_CHAINS: [1, 26]
        },
        TESTNET: {
            GOVERNANCE_ADDRESS: "0x63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
            GOVERNANCE_CHAIN: 1,
            DATA_SOURCE_ADDRESSES: ["0xf346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0", "0xa27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6"],
            DATA_SOURCE_CHAINS: [1, 26]
        },
        MAINNET: {
            GOVERNANCE_ADDRESS: "0x5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
            GOVERNANCE_CHAIN: 1,
            DATA_SOURCE_ADDRESSES: ["0x6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25", "0xf8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0"],
            DATA_SOURCE_CHAINS: [1, 26]
        }
}
