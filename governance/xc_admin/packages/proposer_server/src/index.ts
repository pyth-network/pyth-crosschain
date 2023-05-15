import express, { Request, Response } from "express";
import cors from "cors";
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  envOrErr,
  getMultisigCluster,
  isRemoteCluster,
  PRICE_FEED_MULTISIG,
  proposeInstructions,
  WORMHOLE_ADDRESS,
} from "xc_admin_common";
import * as fs from "fs";
import { PythCluster } from "@pythnetwork/client";
import SquadsMesh from "@sqds/mesh";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

const RPC_URLS: Record<Cluster | "localnet", string> = {
  "mainnet-beta": "http://rpc-mainnet.rpc-mainnet",
  testnet: "http://rpc-testnet.rpc-testnet",
  devnet: "http://rpc-devnet.rpc-devnet",
  localnet: "http://localhost:8899",
};

const app = express();

app.use(cors());
app.use(express.json());

const PORT: number = Number(process.env.PORT ?? "3000");
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);

app.post("/api/propose", async (req: Request, res: Response) => {
  try {
    const instructions: TransactionInstruction[] = req.body.instructions.map(
      (ix: any) =>
        new TransactionInstruction({
          data: Buffer.from(ix.data),
          programId: new PublicKey(ix.programId),
          keys: ix.keys.map((key: any) => {
            return {
              isSigner: key.isSigner,
              isWritable: key.isWritable,
              pubkey: new PublicKey(key.pubkey),
            };
          }),
        })
    );

    const cluster: PythCluster = req.body.cluster;

    const proposeSquads: SquadsMesh = new SquadsMesh({
      connection: new Connection(RPC_URLS[getMultisigCluster(cluster)]),
      wallet: new NodeWallet(KEYPAIR),
    });

    const proposalPubkey = await proposeInstructions(
      proposeSquads,
      PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
      instructions,
      isRemoteCluster(cluster),
      WORMHOLE_ADDRESS[getMultisigCluster(cluster)]
    );
    res.status(200).json({ proposalPubkey });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json(error.message);
    } else {
      res.status(500).json("An unknown error occurred");
    }
  }
});

app.listen(PORT);
