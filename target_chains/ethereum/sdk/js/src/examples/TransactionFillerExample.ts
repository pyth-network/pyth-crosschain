import {
  TransactionFiller,
  fillTransactionWithPythData,
  type TransactionContent,
  type PublicClient,
} from "../TransactionFiller";

interface Chain {
  id: number;
  name: string;
}

const mainnet: Chain = { id: 1, name: "Ethereum Mainnet" };

function createPublicClient(config: {
  chain: Chain;
  transport: any;
}): PublicClient {
  return {
    async getChainId() {
      return config.chain.id;
    },
    async request() {
      return {};
    },
  } as PublicClient;
}

function http(url: string) {
  return { url };
}

async function main() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http("https://eth.drpc.org"),
  });

  const config = {
    pythContractAddress: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6" as const,
    priceServiceEndpoint: "https://hermes.pyth.network",
    viemClient: client,
    maxIterations: 3,
  };

  const transaction: TransactionContent = {
    from: "0x0000000000000000000000000000000000000000",
    to: "0xe0a80d35bB6618CBA260120b279d357978c42BCE",
    data: "0xa824bf67000000000000000000000000c1d023141ad6935f81e5286e577768b75c9ff8e90000000000000000000000000000000000000000000000000000000000000001",
  };

  try {
    console.log("Filling transaction with Pyth data...");

    const result = await fillTransactionWithPythData(config, transaction);

    console.log("Transaction filled successfully!");
    console.log("Detected price feeds:", result.detectedPriceFeeds.length);
    console.log("Price feed IDs:", result.detectedPriceFeeds);
    console.log("Price updates:", result.priceUpdateData.length);
    console.log("Iterations:", result.iterations);
    console.log("Final transaction to:", result.transaction.to);

    if (result.detectedPriceFeeds.length > 0) {
      console.log("Transaction was bundled with price updates using multicall");
    } else {
      console.log(
        "No Pyth price feeds detected, original transaction unchanged",
      );
    }
  } catch (error) {
    console.error("Error filling transaction:", error);
  }
}

async function classBasedExample() {
  const client = createPublicClient({
    chain: mainnet,
    transport: http("https://eth.drpc.org"),
  });

  const filler = new TransactionFiller({
    pythContractAddress: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
    priceServiceEndpoint: "https://hermes.pyth.network",
    viemClient: client,
  });

  const transaction: TransactionContent = {
    to: "0xe0a80d35bB6618CBA260120b279d357978c42BCE",
    data: "0xa824bf67000000000000000000000000c1d023141ad6935f81e5286e577768b75c9ff8e90000000000000000000000000000000000000000000000000000000000000001",
  };

  const result = await filler.fillTransaction(transaction);
  console.log("Class-based example result:", result);
}

export { main, classBasedExample };
