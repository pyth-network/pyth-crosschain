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
  MultisigVault,
  PRICE_FEED_MULTISIG,
} from "@pythnetwork/xc-admin-common";
import * as fs from "fs";
import { getPythClusterApiUrl, PythCluster } from "@pythnetwork/client";
import SquadsMesh from "@sqds/mesh";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

const PORT: number = Number(process.env.PORT ?? "4000");
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii"))),
);
const MAINNET_RPC: string =
  process.env.MAINNET_RPC ?? getPythClusterApiUrl("mainnet-beta");
const DEVNET_RPC: string =
  process.env.DEVNET_RPC ?? getPythClusterApiUrl("devnet");
const TESTNET_RPC: string =
  process.env.TESTNET_RPC ?? getPythClusterApiUrl("testnet");
const LOCALNET_RPC: string =
  process.env.LOCALNET_RPC ?? getPythClusterApiUrl("localnet");

const RPC_URLS: Record<Cluster | "localnet", string> = {
  "mainnet-beta": MAINNET_RPC,
  devnet: DEVNET_RPC,
  testnet: TESTNET_RPC,
  localnet: LOCALNET_RPC,
};

const COMPUTE_UNIT_PRICE_MICROLAMPORTS: number | undefined = process.env
  .COMPUTE_UNIT_PRICE_MICROLAMPORTS
  ? Number(process.env.COMPUTE_UNIT_PRICE_MICROLAMPORTS)
  : undefined;

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
        }),
    );

    const cluster: PythCluster = req.body.cluster;

    const wallet = new NodeWallet(KEYPAIR);
    const proposeSquads: SquadsMesh = new SquadsMesh({
      connection: new Connection(RPC_URLS[getMultisigCluster(cluster)]),
      wallet,
    });

    const vault = new MultisigVault(
      wallet,
      getMultisigCluster(cluster),
      proposeSquads,
      PRICE_FEED_MULTISIG[getMultisigCluster(cluster)],
    );

    // preserve the existing API by returning only the first pubkey
    const proposalPubkey = (
      await vault.proposeInstructions(instructions, cluster, {
        computeUnitPriceMicroLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS,
      })
    )[0];
    res.status(200).json({ proposalPubkey: proposalPubkey });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json(error.message);
    } else {
      res.status(500).json("An unknown error occurred");
    }
  }
});

app.listen(PORT);
