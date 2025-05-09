"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const index_1 = require("../index");
const const_1 = require("../const");
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const idlDummy_json_1 = __importDefault(require("./idl/idlDummy.json"));
const svm_1 = require("../svm");
const DAY_IN_SECONDS = 60 * 60 * 24;
const DUMMY_PIDS = {
  "development-solana": new web3_js_1.PublicKey(
    "HYCgALnu6CM2gkQVopa1HGaNf8Vzbs9bomWRiKP267P3",
  ),
};
class SimpleSearcherSvm {
  endpointExpressRelay;
  chainId;
  privateKey;
  endpointSvm;
  apiKey;
  client;
  connectionSvm;
  constructor(endpointExpressRelay, chainId, privateKey, endpointSvm, apiKey) {
    this.endpointExpressRelay = endpointExpressRelay;
    this.chainId = chainId;
    this.privateKey = privateKey;
    this.endpointSvm = endpointSvm;
    this.apiKey = apiKey;
    this.client = new index_1.Client(
      {
        baseUrl: endpointExpressRelay,
        apiKey,
      },
      undefined,
      () => {
        return Promise.resolve();
      },
      this.bidStatusHandler.bind(this),
    );
    this.connectionSvm = new web3_js_1.Connection(endpointSvm, "confirmed");
  }
  async bidStatusHandler(bidStatus) {
    let resultDetails = "";
    if (bidStatus.type == "submitted" || bidStatus.type == "won") {
      resultDetails = `, transaction ${bidStatus.result}`;
    } else if (bidStatus.type == "lost") {
      if (bidStatus.result) {
        resultDetails = `, transaction ${bidStatus.result}`;
      }
    }
    console.log(
      `Bid status for bid ${bidStatus.id}: ${bidStatus.type}${resultDetails}`,
    );
  }
  async dummyBid() {
    const secretKey = anchor.utils.bytes.bs58.decode(this.privateKey);
    const searcher = web3_js_1.Keypair.fromSecretKey(secretKey);
    const provider = new anchor_1.AnchorProvider(
      this.connectionSvm,
      new anchor.Wallet(searcher),
      {},
    );
    const dummy = new anchor_1.Program(idlDummy_json_1.default, provider);
    const permission = web3_js_1.PublicKey.default;
    const router = web3_js_1.Keypair.generate().publicKey;
    const svmConstants = const_1.SVM_CONSTANTS[this.chainId];
    if (!(this.chainId in DUMMY_PIDS)) {
      throw new Error(`Dummy program id not found for chain ${this.chainId}`);
    }
    const dummyPid = DUMMY_PIDS[this.chainId];
    const configRouter = (0, svm_1.getConfigRouterPda)(this.chainId, router);
    const expressRelayMetadata = (0, svm_1.getExpressRelayMetadataPda)(
      this.chainId,
    );
    const accounting = web3_js_1.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("accounting")],
      dummyPid,
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
      this.connectionSvm,
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
      expressRelayConfig.feeReceiverRelayer,
    );
    try {
      const { blockhash } = await this.connectionSvm.getLatestBlockhash();
      bid.transaction.recentBlockhash = blockhash;
      bid.transaction.sign(web3_js_1.Keypair.fromSecretKey(secretKey));
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
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
  if (const_1.SVM_CONSTANTS[argv.chainId] === undefined) {
    throw new Error(`SVM constants not found for chain ${argv.chainId}`);
  }
  const searcherSvm = web3_js_1.Keypair.fromSecretKey(
    anchor.utils.bytes.bs58.decode(argv.privateKey),
  );
  console.log(`Using searcher pubkey: ${searcherSvm.publicKey.toBase58()}`);
  const simpleSearcher = new SimpleSearcherSvm(
    argv.endpointExpressRelay,
    argv.chainId,
    argv.privateKey,
    argv.endpointSvm,
    argv.apiKey,
  );
  await simpleSearcher.start();
}
run();
