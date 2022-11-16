import { PythUpgradable, PythUpgradable__factory } from "./evm/bindings/index";

import * as ethers from "ethers";
import * as solWeb3 from "@solana/web3.js";
import * as borsh from "borsh";

export interface Config {
  mainnet: MainnetConfig;
  testnet: TestnetConfig;
  localDevnet: LocalDevnetConfig;
}

export interface NetworkConfig {
  getEvmConfigs(): EvmConfig[];
  getSolConfigs(): SolConfig[];
}

export class MainnetConfig implements NetworkConfig {
  getEvmConfigs(): EvmConfig[] {
    return [];
  }

  getSolConfigs(): SolConfig[] {
    return [];
  }
}

export class LocalDevnetConfig implements NetworkConfig {
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

export class TestnetConfig implements NetworkConfig {
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

export interface EvmConfig {
  rpcUrl: string;
  targetChainContract: string;
}

export async function getEvmDataSources(cfg: EvmConfig): Promise<any[]> {
  let provider = new ethers.providers.JsonRpcProvider(cfg.rpcUrl);

  let signer = new ethers.VoidSigner(cfg.targetChainContract, provider);

  let factory = new PythUpgradable__factory(signer);

  let contract = factory.attach(cfg.targetChainContract);

  return await contract.validDataSources();
}

export interface SolConfig {
  rpcUrl: string;
  attesterContract: solWeb3.PublicKey;
}

export interface AttesterConfigState {
  owner: solWeb3.PublicKey;
  whProg: solWeb3.PublicKey;
  pythOwner: solWeb3.PublicKey;
  maxBatchSize: number;
  isActive: boolean;
  opsOwner: solWeb3.PublicKey | null;
}

// Helper catch-all object to contain the deserialized schema of SOL accounts
class Assignable {
  constructor(properties) {
    Object.keys(properties).map((key) => {
      return (this[key] = properties[key]);
    });
  }
}

export async function getAttesterConfig(
  cfg: SolConfig,
): Promise<AttesterConfigState> {
  let conn = new solWeb3.Connection(cfg.rpcUrl, "finalized");

  let [cfgAddr, _bumpSeed] = await solWeb3.PublicKey.findProgramAddress([
    Buffer.from("pyth2wormhole-config-v3"),
  ], cfg.attesterContract);

  console.log("Looking up account", cfgAddr.toString());

  let rawAccInfo = await conn.getAccountInfo(cfgAddr);

  let schema = new Map([[Assignable, {
    kind: "struct",
    fields: [
      ["owner", [32]],
      ["wh_prog", [32]],
      ["pyth_owner", [32]],
      ["max_batch_size", "u16"],
      ["is_active", "bool"],
      ["ops_owner", [32]],
    ],
  }]]);

  console.log("Raw Account Data: ", rawAccInfo.data);

  let parsed = borsh.deserialize(
    new Map(),
    Assignable,
    rawAccInfo.data,
  );

  return {
    owner: new solWeb3.PublicKey(parsed["owner"]),
    whProg: new solWeb3.PublicKey(parsed["wh_prog"]),
    pythOwner: new solWeb3.PublicKey(parsed["pyth_owner"]),
    maxBatchSize: parsed["max_batch_size"],
    isActive: parsed["is_active"],
    opsOwner: new solWeb3.PublicKey(parsed["ops_owner"]),
  };
}
