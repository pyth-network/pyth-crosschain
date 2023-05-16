/// We build a programmable txn to create a price feed.
import dotenv from "dotenv";

import {
  RawSigner,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
  JsonRpcProvider,
  Ed25519Keypair,
  Connection,
} from "@optke3/sui.js";

dotenv.config({ path: "~/.env" });

import { REGISTRY, NETWORK } from "../registry";

// Network dependent settings.
let network = NETWORK.TESTNET; // <= NOTE: Update this when changing network
const walletPrivateKey = process.env.SUI_TESTNET; // <= NOTE: Update this when changing network
const registry = REGISTRY[network];
const provider = new JsonRpcProvider(
  new Connection({ fullnode: registry["RPC_URL"] })
);

async function main() {
  if (walletPrivateKey === undefined) {
    throw new Error("SUI_TESTNET unset in environment");
  }
  const wallet = new RawSigner(
    Ed25519Keypair.fromSecretKey(Buffer.from(walletPrivateKey, "hex")),
    provider
  );
  let sender = await wallet.getAddress();
  let recipient =
    "0x4ed01b6abcc271a5c7a1e05ee9344d6eb72d0c1f2483a1c600b46d73a22ba764";
  console.log("Sender: ", sender);
  transfer_tokens(wallet, recipient);
}

main();

async function transfer_tokens(signer: RawSigner, recipient: string) {
  const tx = new TransactionBlock();

  let coin = tx.splitCoins(tx.gas, [tx.pure(100000000000)]);

  tx.transferObjects([coin], tx.pure(recipient));

  tx.setGasBudget(1000000000);

  let result = await signer.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });
  console.log(result);
  return result;
}
