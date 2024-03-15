import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  BidStatusUpdate,
  checkAddress,
  checkHex,
  Client,
  Opportunity,
} from "../index";
import { privateKeyToAccount } from "viem/accounts";
import {
  Address,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getContract,
  Hex,
  http,
  isHex,
  parseAbi,
} from "viem";
import type { ContractFunctionReturnType } from "viem";
import { optimismSepolia } from "viem/chains";
import { abi } from "./abi";
import {
  PriceFeed,
  PriceServiceConnection,
} from "@pythnetwork/price-service-client";

const DAY_IN_SECONDS = 60 * 60 * 24;

class ProtocolMonitor {
  private client: Client;
  private subscribedIds: Set<string> = new Set();
  private prices: Record<string, PriceFeed> = {};
  private priceConnection: PriceServiceConnection;

  constructor(
    public expressRelayEndpoint: string,
    public rpcEndpoint: string,
    public chainId: string,
    public wethContract: Address,
    public vaultContract: Address
  ) {
    this.client = new Client({ baseUrl: expressRelayEndpoint });
    this.priceConnection = new PriceServiceConnection(
      "https://hermes.pyth.network",
      {
        priceFeedRequestConfig: { binary: true },
      }
    );
  }

  updatePrice(feed: PriceFeed) {
    this.prices[feed.id] = feed;
  }

  async subscribeToPriceFeed(tokenId: string) {
    if (!this.subscribedIds.has(tokenId)) {
      await this.priceConnection.subscribePriceFeedUpdates(
        [tokenId],
        this.updatePrice.bind(this)
      );
      this.subscribedIds.add(tokenId);
    }
  }

  async start() {
    const rpcClient = createPublicClient({
      chain: optimismSepolia,
      transport: http(),
    });
    const contract = getContract({
      address: this.vaultContract,
      abi,
      client: rpcClient,
    });
    const lastVaultId = await contract.read.getLastVaultId();
    const vaults = [];
    for (let vaultId = 0n; vaultId < lastVaultId; vaultId++) {
      const vault = await contract.read.getVault([vaultId]);
      // Already liquidated vault
      if (vault.amountCollateral == 0n && vault.amountDebt == 0n) {
        continue;
      }
      vaults.push({ id: vaultId, ...vault });
      await this.subscribeToPriceFeed(vault.tokenIDCollateral);
      await this.subscribeToPriceFeed(vault.tokenIDDebt);
    }

    for (const vault of vaults) {
      if (
        !this.prices[vault.tokenIDCollateral] ||
        !this.prices[vault.tokenIDDebt]
      ) {
        continue;
      }
      const priceCollateral = BigInt(
        this.prices[vault.tokenIDCollateral].getPriceUnchecked().price
      );
      const priceDebt = BigInt(
        this.prices[vault.tokenIDDebt].getPriceUnchecked().price
      );
      const valueCollateral = priceCollateral * vault.amountCollateral;
      const valueDebt = priceDebt * vault.amountDebt;
      const health = valueCollateral / valueDebt;
      if (valueDebt * vault.minHealthRatio > valueCollateral * 10n ** 18n) {
        console.log(
          `Vault ${vault.id} is undercollateralized health: ${health}`
        );
        const priceUpdates = [
          this.prices[vault.tokenIDCollateral].getVAA()!,
          this.prices[vault.tokenIDDebt].getVAA()!,
        ];
        const vaas: Hex[] = priceUpdates.map(
          (vaa): Hex => `0x${Buffer.from(vaa, "base64").toString("hex")}`
        );
        const calldata = encodeFunctionData({
          abi,
          functionName: "liquidateWithPriceUpdate",
          args: [vault.id, vaas],
        });
        const permissionPayload = encodeAbiParameters(
          [{ type: "uint256", name: "vaultId" }],
          [vault.id]
        );
        const permission = encodeAbiParameters(
          [
            { type: "address", name: "contract" },
            { type: "bytes", name: "vaultId" },
          ],
          [this.vaultContract, permissionPayload]
        );
        const targetCallValue = BigInt(priceUpdates.length);
        let sellTokens;
        if (targetCallValue > 0 && vault.tokenDebt == this.wethContract) {
          sellTokens = [
            {
              token: this.wethContract,
              amount: targetCallValue + vault.amountDebt,
            },
          ];
        } else {
          sellTokens = [
            { token: vault.tokenDebt, amount: vault.amountDebt },
            { token: this.wethContract, amount: targetCallValue },
          ];
        }
        const opportunity: Omit<Opportunity, "opportunityId"> = {
          chainId: this.chainId,
          targetContract: this.vaultContract,
          targetCalldata: calldata,
          permissionKey: permission,
          targetCallValue: targetCallValue,
          buyTokens: [
            { token: vault.tokenCollateral, amount: vault.amountCollateral },
          ],
          sellTokens: sellTokens,
        };
        await this.client.submitOpportunity(opportunity);
      }
    }

    try {
      await this.client.subscribeChains([argv.chainId]);
      console.log(
        `Subscribed to chain ${argv.chainId}. Waiting for opportunities...`
      );
    } catch (error) {
      console.error(error);
      this.client.websocket?.close();
    }
  }
}

const argv = yargs(hideBin(process.argv))
  .option("express-relay-endpoint", {
    description:
      "Express relay endpoint. e.g: https://per-staging.dourolabs.app/",
    type: "string",
    demandOption: true,
  })
  .option("rpc-endpoint", {
    description: "",
    type: "string",
    demandOption: true,
  })
  .option("chain-id", {
    description: "Chain id to send opportunities for. e.g: sepolia",
    type: "string",
    demandOption: true,
  })
  .option("weth-contract", {
    description: "wrapped eth contract address",
    type: "string",
    demandOption: true,
  })
  .option("vault-contract", {
    description: "Dummy token vault contract address",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function run() {
  if (isHex(argv.privateKey)) {
    const account = privateKeyToAccount(argv.privateKey);
    console.log(`Using account: ${account.address}`);
  } else {
    throw new Error(`Invalid private key: ${argv.privateKey}`);
  }
  const monitor = new ProtocolMonitor(
    argv.expressRelayEndpoint,
    argv.rpcEndpoint,
    argv.chainId,
    checkAddress(argv.wethContract),
    checkAddress(argv.vaultContract)
  );
  await monitor.start();
}

run();
