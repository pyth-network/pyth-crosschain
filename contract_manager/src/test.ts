import {
  Vault,
  Contracts,
  Vaults,
  loadHotWallet,
  WormholeEmitter,
  SubmittedWormholeMessage,
} from "./entities";
import { SuiContract } from "./sui";
import { CosmWasmContract } from "./cosmwasm";
import { Ed25519Keypair, RawSigner } from "@mysten/sui.js";
import { DefaultStore } from "./store";
import { Chains } from "./chains";
import { executeProposal } from "xc_admin_common";

async function test() {
  // Deploy the same cosmwasm code with different config

  // let c = Contracts.osmosis_testnet_5_osmo1lltupx02sj99suakmuk4sr4ppqf34ajedaxut3ukjwkv6469erwqtpg9t3 as CosmWasmContract;
  // let old_conf = await c.getConfig();
  // let config = CosmWasmContract.getDeploymentConfig(c.chain, 'edge', old_conf.config_v1.wormhole_contract);
  // console.log(config);
  // config.governance_source.emitter = wallet.publicKey.toBuffer().toString('base64');
  // let mnemonic = 'FILLME'
  // console.log(await CosmWasmContract.deploy(c.chain, await c.getCodeId(), config, mnemonic));

  let s = DefaultStore;
  Object.values(Contracts).forEach((c) => {
    console.log(c);
    s.save(c);
  });

  Object.values(Chains).forEach((c) => {
    console.log(c);
    s.save(c);
  });

  // Execute some governance instruction on sui contract

  // let c = Contracts.sui_testnet_0x651dcb84d579fcdf51f15d79eb28f7e10b416c9202b6a156495bb1a4aecd55ea as SuiContract
  // let wallet = await loadHotWallet('/tmp/priv.json');
  // let emitter = new WormholeEmitter("devnet", wallet);
  // let proposal = c.setUpdateFee(200);
  // let submittedWormholeMessage = await emitter.sendMessage(proposal);
  // let vaa = await submittedWormholeMessage.fetchVAA(10);
  // const keypair = Ed25519Keypair.fromSecretKey(Buffer.from('FILLME', "hex"));
  // await c.executeGovernanceInstruction(vaa);
}

test();
