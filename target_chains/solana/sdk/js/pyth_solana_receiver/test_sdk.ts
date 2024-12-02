import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import axios from "axios";
import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
} from "@pythnetwork/price-service-sdk";
async function main() {
  // // Setup connection and wallet
  // const connection = new Connection("https://api.mainnet-beta.solana.com");

  // // Load keypair from file - you'll need to replace this with your keypair
  // const keypair = Keypair.fromSecretKey(
  //   Buffer.from(JSON.parse(require('fs').readFileSync('/path/to/your/keypair.json', 'utf-8')))
  // );
  // const wallet = new Wallet(keypair);

  // // Initialize Pyth Solana Receiver
  // const pythSolanaReceiver = new PythSolanaReceiver({ connection, wallet });

  const data =
    "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";
  const parsed = parseAccumulatorUpdateData(Buffer.from(data, "base64"));

  console.log("vaa", parsed.vaa);
  console.log("updates", parsed.updates);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
