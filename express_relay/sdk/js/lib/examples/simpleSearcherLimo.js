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
const web3_js_1 = require("@solana/web3.js");
const limo = __importStar(require("@kamino-finance/limo-sdk"));
const decimal_js_1 = require("decimal.js");
const utils_1 = require("@kamino-finance/limo-sdk/dist/utils");
const DAY_IN_SECONDS = 60 * 60 * 24;
class SimpleSearcherLimo {
  endpointExpressRelay;
  chainId;
  searcher;
  endpointSvm;
  fillRate;
  apiKey;
  client;
  connectionSvm;
  mintDecimals = {};
  expressRelayConfig;
  constructor(
    endpointExpressRelay,
    chainId,
    searcher,
    endpointSvm,
    fillRate,
    apiKey,
  ) {
    this.endpointExpressRelay = endpointExpressRelay;
    this.chainId = chainId;
    this.searcher = searcher;
    this.endpointSvm = endpointSvm;
    this.fillRate = fillRate;
    this.apiKey = apiKey;
    this.client = new index_1.Client(
      {
        baseUrl: endpointExpressRelay,
        apiKey,
      },
      undefined,
      this.opportunityHandler.bind(this),
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
  async getMintDecimalsCached(mint) {
    const mintAddress = mint.toBase58();
    if (this.mintDecimals[mintAddress]) {
      return this.mintDecimals[mintAddress];
    }
    const decimals = await (0, utils_1.getMintDecimals)(
      this.connectionSvm,
      mint,
    );
    this.mintDecimals[mintAddress] = decimals;
    return decimals;
  }
  async generateBid(opportunity) {
    const order = opportunity.order;
    const limoClient = new limo.LimoClient(
      this.connectionSvm,
      order.state.globalConfig,
    );
    const inputMintDecimals = await this.getMintDecimalsCached(
      order.state.inputMint,
    );
    const outputMintDecimals = await this.getMintDecimalsCached(
      order.state.outputMint,
    );
    const effectiveFillRate = Math.min(
      this.fillRate,
      (100 * order.state.remainingInputAmount.toNumber()) /
        order.state.initialInputAmount.toNumber(),
    );
    const inputAmountDecimals = new decimal_js_1.Decimal(
      order.state.initialInputAmount.toNumber(),
    )
      .div(new decimal_js_1.Decimal(10).pow(inputMintDecimals))
      .mul(effectiveFillRate)
      .div(100);
    const outputAmountDecimals = new decimal_js_1.Decimal(
      order.state.expectedOutputAmount.toNumber(),
    )
      .div(new decimal_js_1.Decimal(10).pow(outputMintDecimals))
      .mul(effectiveFillRate)
      .div(100);
    console.log("Order address", order.address.toBase58());
    console.log("Fill rate", effectiveFillRate);
    console.log(
      "Sell token",
      order.state.inputMint.toBase58(),
      "amount:",
      inputAmountDecimals.toString(),
    );
    console.log(
      "Buy token",
      order.state.outputMint.toBase58(),
      "amount:",
      outputAmountDecimals.toString(),
    );
    const ixsTakeOrder = await limoClient.takeOrderIx(
      this.searcher.publicKey,
      order,
      inputAmountDecimals,
      outputAmountDecimals,
      const_1.SVM_CONSTANTS[this.chainId].expressRelayProgram,
      inputMintDecimals,
      outputMintDecimals,
    );
    const txRaw = new anchor.web3.Transaction().add(...ixsTakeOrder);
    const router = (0, utils_1.getPdaAuthority)(
      limoClient.getProgramID(),
      order.state.globalConfig,
    );
    const bidAmount = new anchor.BN(argv.bid);
    if (!this.expressRelayConfig) {
      this.expressRelayConfig = await this.client.getExpressRelaySvmConfig(
        this.chainId,
        this.connectionSvm,
      );
    }
    const bid = await this.client.constructSvmBid(
      txRaw,
      this.searcher.publicKey,
      router,
      order.address,
      bidAmount,
      new anchor.BN(Math.round(Date.now() / 1000 + DAY_IN_SECONDS)),
      this.chainId,
      this.expressRelayConfig.relayerSigner,
      this.expressRelayConfig.feeReceiverRelayer,
    );
    bid.transaction.recentBlockhash = opportunity.blockHash;
    bid.transaction.sign(this.searcher);
    return bid;
  }
  async opportunityHandler(opportunity) {
    const bid = await this.generateBid(opportunity);
    try {
      const bidId = await this.client.submitBid(bid);
      console.log(
        `Successful bid. Opportunity id ${opportunity.opportunityId} Bid id ${bidId}`,
      );
    } catch (error) {
      console.error(
        `Failed to bid on opportunity ${opportunity.opportunityId}: ${error}`,
      );
    }
  }
  async start() {
    try {
      await this.client.subscribeChains([argv.chainId]);
      console.log(
        `Subscribed to chain ${argv.chainId}. Waiting for opportunities...`,
      );
    } catch (error) {
      console.error(error);
      this.client.websocket?.close();
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
    description: "Chain id to bid on Limo opportunities for. e.g: solana",
    type: "string",
    demandOption: true,
  })
  .option("bid", {
    description: "Bid amount in lamports",
    type: "string",
    default: "100",
  })
  .option("private-key", {
    description: "Private key of the searcher in base58 format",
    type: "string",
    conflicts: "private-key-json-file",
  })
  .option("private-key-json-file", {
    description:
      "Path to a json file containing the private key of the searcher in array of bytes format",
    type: "string",
    conflicts: "private-key",
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
  .option("fill-rate", {
    description:
      "How much of the initial order size to fill in percentage. Default is 100%",
    type: "number",
    default: 100,
  })
  .help()
  .alias("help", "h")
  .parseSync();
async function run() {
  if (!const_1.SVM_CONSTANTS[argv.chainId]) {
    throw new Error(`SVM constants not found for chain ${argv.chainId}`);
  }
  let searcherKeyPair;
  if (argv.privateKey) {
    const secretKey = anchor.utils.bytes.bs58.decode(argv.privateKey);
    searcherKeyPair = web3_js_1.Keypair.fromSecretKey(secretKey);
  } else if (argv.privateKeyJsonFile) {
    searcherKeyPair = web3_js_1.Keypair.fromSecretKey(
      Buffer.from(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        JSON.parse(require("fs").readFileSync(argv.privateKeyJsonFile)),
      ),
    );
  } else {
    throw new Error(
      "Either private-key or private-key-json-file must be provided",
    );
  }
  console.log(`Using searcher pubkey: ${searcherKeyPair.publicKey.toBase58()}`);
  const simpleSearcher = new SimpleSearcherLimo(
    argv.endpointExpressRelay,
    argv.chainId,
    searcherKeyPair,
    argv.endpointSvm,
    argv.fillRate,
    argv.apiKey,
  );
  await simpleSearcher.start();
}
run();
