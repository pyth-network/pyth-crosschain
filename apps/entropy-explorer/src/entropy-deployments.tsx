import type { ReactNode } from "react";

export type EntropyDeployment = {
  address: string;
  network: "mainnet" | "testnet";
  rpc: string;
  explorerTxTemplate: string;
  explorerAccountTemplate: string;
  name: string;
  icon: ReactNode;
};

export const EntropyDeployments = {
  // "lightlink-pegasus-testnet": {
  //   address: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "chiliz-spicy": {
  //   address: "0xD458261E832415CFd3BAE5E416FdF3230ce6F134",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "mode-testnet": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "arbitrum-sepolia": {
  //   address: "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "blast-s2-testnet": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "lightlink-phoenix": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "chiliz": {
  //   address: "0x0708325268dF9F66270F1401206434524814508b",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "arbitrum": {
  //   address: "0x7698E925FfC29655576D0b361D75Af579e20AdAc",
  //   network: "mainnet",
  //   explorerTxTemplate: "https://arbiscan.io/address/$ADDRESS",
  //   explorerAccountTemplate: "https://arbiscan.io/tx/$ADDRESS",
  //   name: "Arbitrum One",
  //   icon: <></>
  // },
  // "optimism": {
  //   address: "0xdF21D137Aadc95588205586636710ca2890538d5",
  //   network: "mainnet",
  //   explorerTxTemplate: "https://optimistic.etherscan.io/tx/$ADDRESS",
  //   explorerAccountTemplate: "https://optimistic.etherscan.io/address/$ADDRESS",
  //   name: "OP Mainnet",
  //   icon: <></>
  // },
  [84_532]: {
    address: "0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c",
    network: "testnet",
    rpc: "https://sepolia.base.org",
    explorerTxTemplate: "https://base-sepolia.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://base-sepolia.blockscout.com/address/$ADDRESS",
    name: "Base Sepolia",
    icon: <></>,
  },
  [11_155_420]: {
    address: "0x4821932D0CDd71225A6d914706A621e0389D7061",
    network: "testnet",
    rpc: "https://api.zan.top/opt-sepolia",
    explorerTxTemplate: "https://optimism-sepolia.blockscout.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://optimism-sepolia.blockscout.com/address/$ADDRESS",
    name: "Optimism Sepolia",
    icon: <></>,
  },
  // "mode": {
  //   address: "0x8D254a21b3C86D32F7179855531CE99164721933",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "coredao-testnet": {
  //   address: "0xf0a1b566B55e0A0CB5BeF52Eb2a57142617Bee67",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "blast": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "zetachain-testnet": {
  //   address: "0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "zetachain": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "base": {
  //   address: "0x6E7D74FA7d5c90FEF9F0512987605a6d546181Bb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "taiko-hekla": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "orange-testnet": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "sei-evm-mainnet": {
  //   address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "merlin": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "taiko-mainnet": {
  //   address: "0x26DD80569a8B23768A1d80869Ed7339e07595E85",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "merlin-testnet": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "etherlink-testnet": {
  //   address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "etherlink": {
  //   address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "sei-evm-testnet": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "kaia-testnet": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "kaia": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "b3-testnet": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "b3-mainnet": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "apechain-testnet": {
  //   address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "soneium-minato-testnet": {
  //   address: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "apechain-mainnet": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "sanko": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  [1992]: {
    address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
    network: "testnet",
    rpc: "https://sanko-arb-sepolia.rpc.caldera.xyz/http",
    explorerTxTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://sanko-arb-sepolia.explorer.caldera.xyz/address/$ADDRESS",
    name: "Sanko Testnet",
    icon: <></>,
  },
  // "abstract-testnet": {
  //   address: "0x858687fD592112f7046E394A3Bf10D0C11fF9e63",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "unichain": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "abstract": {
  //   address: "0x5a4a369F4db5df2054994AF031b7b23949b98c0e",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "sonic-blaze-testnet": {
  //   address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "unichain-sepolia": {
  //   address: "0x8D254a21b3C86D32F7179855531CE99164721933",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "fantom-sonic-mainnet": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "tabi-testnet": {
  //   address: "0xEbe57e8045F2F230872523bbff7374986E45C486",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  [10_143]: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    network: "testnet",
    rpc: "https://testnet-rpc.monad.xyz",
    explorerTxTemplate: "https://testnet.monadexplorer.com/tx/$ADDRESS",
    explorerAccountTemplate:
      "https://testnet.monadexplorer.com/address/$ADDRESS",
    name: "Monad Testnet",
    icon: <></>,
  },
  [80_094]: {
    address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
    network: "mainnet",
    rpc: "https://rpc.berachain.com",
    explorerTxTemplate: "https://berascan.com/tx/$ADDRESS",
    explorerAccountTemplate: "https://berascan.com/address/$ADDRESS",
    name: "Berachain",
    icon: <></>,
  },
  // "hyperevm": {
  //   address: "0xfA25E653b44586dBbe27eE9d252192F0e4956683",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "story": {
  //   address: "0xdF21D137Aadc95588205586636710ca2890538d5",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "story-testnet": {
  //   address: "0x5744Cbf430D99456a0A8771208b674F27f8EF0Fb",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "berachain-bepolia": {
  //   address: "0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
  // "soneium": {
  //   address: "0x0708325268dF9F66270F1401206434524814508b",
  //   network: "mainnet",
  //   explorerTxTemplate: "",
  //   explorerAccountTemplate: "",
  //   name: "",
  //   icon: <></>
  // },
} as const satisfies Record<string, EntropyDeployment>;

export const isValidDeployment = (
  name: number,
): name is keyof typeof EntropyDeployments =>
  Object.prototype.hasOwnProperty.call(EntropyDeployments, name);
