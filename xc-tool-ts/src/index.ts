import { PythUpgradable, PythUpgradable__factory } from "./evm/bindings/";

import * as ethers from "ethers";

interface Config {
  mainnet: MainnetConfig;
  testnet: TestnetConfig;
  localDevnet: LocalDevnetConfig;
}

interface NetworkConfig {
  getEvmConfigs(): EvmConfig[];
  getSolConfigs(): SolConfig[];
}

class MainnetConfig implements NetworkConfig {
  getEvmConfigs(): EvmConfig[] {
    return [];
  }

  getSolConfigs(): SolConfig[] {
    return [];
  }
}

class LocalDevnetConfig implements NetworkConfig {
  ethereum: EvmConfig;
  solana: SolConfig;
  constructor(arg: { ethereum: EvmConfig; solana: SolConfig }) {
    this.ethereum = arg.ethereum;
    this.solana = arg.solana;
  }

  getEvmConfigs(): EvmConfig[] {
    return [this.ethereum];
  }

  getSolConfigs(): SolConfig[] {
    return [this.solana];
  }
}

class TestnetConfig implements NetworkConfig {
  ethereum: EvmConfig;
  aurora: EvmConfig;
  bnb: EvmConfig;
  solana: SolConfig;
  pythtest: SolConfig;
  constructor(
    arg: {
      ethereum: EvmConfig;
      aurora: EvmConfig;
      bnb: EvmConfig;
      solana: SolConfig;
      pythtest: SolConfig;
    },
  ) {
    this.ethereum = arg.ethereum;
    this.aurora = arg.aurora;
    this.bnb = arg.bnb;
    this.solana = arg.solana;
    this.pythtest = arg.pythtest;
  }

  getEvmConfigs(): EvmConfig[] {
    return [this.ethereum, this.aurora, this.bnb];
  }

  getSolConfigs(): SolConfig[] {
    return [this.solana, this.pythtest];
  }
}

interface EvmConfig {
  rpcUrl: string;
  targetChainContract: string;
}

async function getEvmDataSources(cfg: EvmConfig): Promise<any[]> {
  let provider = new ethers.providers.JsonRpcProvider(cfg.rpcUrl);

  let signer = new ethers.VoidSigner("0x01");

  let factory = new PythUpgradable__factory(signer);

  let contract = factory.attach(cfg.targetChainContract);

  return await contract.validDataSources();
}

interface SolConfig {
  rpcUrl: string;
  attesterContract: string;
}

async function getSolAttesterConfig(cfg: SolConfig): Promise<any> {
    l
    
}

const DEFAULTS: Config = {
  mainnet: new MainnetConfig(),
  testnet: new TestnetConfig(
    {
      ethereum: {
        rpcUrl: "https://rpc.goerli.mudit.blog/",
        targetChainContract: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
      },
      aurora: {
        rpcUrl: "https://testnet.aurora.dev",
        targetChainContract: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
      },
      bnb: {
        rpcUrl: "https://bsctestapi.terminet.io/rpc",
        targetChainContract: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
      },
      solana: {
        rpcUrl: "https://api.devnet.solana.com",
        attesterContract: "dnSeccJXMXPw3KQSodXRzN9oJQNj6rrU6Ztroean2Wq",
      },
      pythtest: {
        rpcUrl: "https://api.devnet.solana.com",
        attesterContract: "dnSeccJXMXPw3KQSodXRzN9oJQNj6rrU6Ztroean2Wq",
      },
    },
  ),
  localDevnet: new LocalDevnetConfig({
    ethereum: {
      rpcUrl: "http://localhost:8545",
      targetChainContract: "0xe982E462b094850F12AF94d21D470e21bE9D0E9C",
    },
    solana: {
      rpcUrl: "http://localhost:8899",
      attesterContract: "P2WH424242424242424242424242424242424242424",
    },
  }),
};
