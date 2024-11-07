import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Client } from "../index";
import { BidStatusUpdate } from "../types";
import { SVM_CONSTANTS } from "../const";

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import dummyIdl from "./idl/idlDummy.json";
import { Dummy } from "./dummyTypes";
import { getConfigRouterPda, getExpressRelayMetadataPda } from "../svm";

const DAY_IN_SECONDS = 60 * 60 * 24;
const DUMMY_PIDS: Record<string, PublicKey> = {
  "development-solana": new PublicKey(
    "HYCgALnu6CM2gkQVopa1HGaNf8Vzbs9bomWRiKP267P3"
  ),
};

class SimpleSearcherSvm {
  private client: Client;
  private connectionSvm: Connection;
  constructor(
    public endpointExpressRelay: string,
    public chainId: string,
    public privateKey: string,
    public endpointSvm: string,
    public apiKey?: string
  ) {
    this.client = new Client(
      {
        baseUrl: endpointExpressRelay,
        apiKey,
      },
      undefined,
      () => {
        return Promise.resolve();
      },
      this.bidStatusHandler.bind(this)
    );
    this.connectionSvm = new Connection(endpointSvm, "confirmed");
  }

  async bidStatusHandler(bidStatus: BidStatusUpdate) {
    let resultDetails = "";
    if (bidStatus.type == "submitted" || bidStatus.type == "won") {
      resultDetails = `, transaction ${bidStatus.result}`;
    } else if (bidStatus.type == "lost") {
      if (bidStatus.result) {
        resultDetails = `, transaction ${bidStatus.result}`;
      }
    }
    console.log(
      `Bid status for bid ${bidStatus.id}: ${bidStatus.type}${resultDetails}`
    );
  }

  async dummyBid() {
    const secretKey = anchor.utils.bytes.bs58.decode(this.privateKey);
    const searcher = Keypair.fromSecretKey(secretKey);

    const provider = new AnchorProvider(
      this.connectionSvm,
      new anchor.Wallet(searcher),
      {}
    );
    const dummy = new Program<Dummy>(dummyIdl as Dummy, provider);

    const permission = PublicKey.default;
    const router = Keypair.generate().publicKey;

    const svmConstants = SVM_CONSTANTS[this.chainId];
    if (!(this.chainId in DUMMY_PIDS)) {
      throw new Error(`Dummy program id not found for chain ${this.chainId}`);
    }
    const dummyPid = DUMMY_PIDS[this.chainId];

    const configRouter = getConfigRouterPda(this.chainId, router);
    const expressRelayMetadata = getExpressRelayMetadataPda(this.chainId);
    const accounting = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("accounting")],
      dummyPid
    )[0];

    const bidAmount = new anchor.BN(argv.bid);

    const ixDummy = await dummy.methods
      .doNothing()
      .accountsStrict({
        payer: searcher.publicKey,
        expressRelay: svmConstants.expressRelayProgram,
        expressRelayMetadata,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        permission,
        router,
        configRouter,
        accounting,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();
    ixDummy.programId = dummyPid;

    const txRaw = new anchor.web3.Transaction().add(ixDummy);
    const expressRelayConfig = await this.client.getExpressRelaySvmConfig(
      this.chainId,
      this.connectionSvm
    );
    const bid = await this.client.constructSvmBid(
      txRaw,
      searcher.publicKey,
      router,
      permission,
      bidAmount,
      new anchor.BN(Math.round(Date.now() / 1000 + DAY_IN_SECONDS)),
      this.chainId,
      expressRelayConfig.relayerSigner,
      expressRelayConfig.feeReceiverRelayer
    );

    try {
      const { blockhash } = await this.connectionSvm.getLatestBlockhash();
      bid.transaction.recentBlockhash = blockhash;
      bid.transaction.sign(Keypair.fromSecretKey(secretKey));
      const bidId = await this.client.submitBid(bid);
      console.log(`Successful bid. Bid id ${bidId}`);
    } catch (error) {
      console.error(`Failed to bid: ${error}`);
    }
  }

  async start() {
    for (;;) {
      await this.dummyBid();
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

const argv = yargs(hideBin(process.argv))
  .option("endpoint-express-relay", {
    description:
      "Express relay endpoint. e.g: https://per-staging.dourolabs.app/",
    type: "string",
    demandOption: true,
  })
  .option("chain-id", {
    description: "Chain id to fetch opportunities for. e.g: solana",
    type: "string",
    demandOption: true,
  })
  .option("bid", {
    description: "Bid amount in lamports",
    type: "string",
    default: "100",
  })
  .option("private-key", {
    description: "Private key to sign the bid with. In 64-byte base58 format",
    type: "string",
    demandOption: true,
  })
  .option("api-key", {
    description:
      "The API key of the searcher to authenticate with the server for fetching and submitting bids",
    type: "string",
    demandOption: false,
  })
  .option("endpoint-svm", {
    description: "SVM RPC endpoint",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();
async function run() {
  if (SVM_CONSTANTS[argv.chainId] === undefined) {
    throw new Error(`SVM constants not found for chain ${argv.chainId}`);
  }
  const searcherSvm = Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(argv.privateKey)
  );
  console.log(`Using searcher pubkey: ${searcherSvm.publicKey.toBase58()}`);

  const simpleSearcher = new SimpleSearcherSvm(
    argv.endpointExpressRelay,
    argv.chainId,
    argv.privateKey,
    argv.endpointSvm,
    argv.apiKey
  );
  await simpleSearcher.start();
}

run();
