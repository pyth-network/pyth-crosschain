import { Connection, Keypair } from "@solana/web3.js";
import { PythSolanaReceiverConnection } from "../index";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

test("Initialize PythSolanaReceiverConnection", () => {
  const pythSolanaReceiverConnection = new PythSolanaReceiverConnection({
    connection: new Connection("https://api.mainnet-beta.solana.com"),
    wallet: new NodeWallet(new Keypair()),
  });
});
