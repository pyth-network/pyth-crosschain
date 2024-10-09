import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  checkAddress,
  Client,
  OpportunityCreate,
} from "@pythnetwork/express-relay-js";
import type { ContractFunctionReturnType } from "viem";
import {
  Address,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getContract,
  Hex,
  http,
} from "viem";
import { optimismSepolia } from "viem/chains";
import { abi } from "./abi";
import {
  PriceFeed,
  PriceServiceConnection,
} from "@pythnetwork/price-service-client";

type VaultWithId = ContractFunctionReturnType<
  typeof abi,
  "view",
  "getVault"
> & { id: bigint };
class ProtocolMonitor {
  private client: Client;
  private subscribedIds: Set<string> = new Set();
  private prices: Record<Hex, PriceFeed> = {};
  private priceConnection: PriceServiceConnection;

  constructor(
    expressRelayEndpoint: string,
    pythEndpoint: string,
    private chainId: string,
    private wethContract: Address,
    private vaultContract: Address,
    private onlyRecent: number | undefined
  ) {
    this.client = new Client({ baseUrl: expressRelayEndpoint });
    this.priceConnection = new PriceServiceConnection(pythEndpoint, {
      priceFeedRequestConfig: { binary: true },
    });
  }

  updatePrice(feed: PriceFeed) {
    this.prices[`0x${feed.id}`] = feed;
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

  async checkVaults() {
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
    const vaults: VaultWithId[] = [];
    let startVaultId = 0n;
    if (this.onlyRecent && lastVaultId > BigInt(this.onlyRecent)) {
      startVaultId = lastVaultId - BigInt(this.onlyRecent);
    }
    for (let vaultId = startVaultId; vaultId < lastVaultId; vaultId++) {
      const vault = await contract.read.getVault([vaultId]);
      // Already liquidated vault
      if (vault.amountCollateral == 0n && vault.amountDebt == 0n) {
        continue;
      }
      vaults.push({ id: vaultId, ...vault });
      await this.subscribeToPriceFeed(vault.tokenIdCollateral);
      await this.subscribeToPriceFeed(vault.tokenIdDebt);
    }

    for (const vault of vaults) {
      if (this.isLiquidatable(vault)) {
        const opportunity = this.createOpportunity(vault);
        await this.client.submitOpportunity(opportunity);
      }
    }
  }

  async start() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await this.checkVaults();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  private createOpportunity(vault: VaultWithId) {
    const priceUpdates = [
      this.prices[vault.tokenIdCollateral].getVAA()!,
      this.prices[vault.tokenIdDebt].getVAA()!,
    ];
    const vaas: Hex[] = priceUpdates.map(
      (vaa): Hex => `0x${Buffer.from(vaa, "base64").toString("hex")}`
    );
    const calldata = encodeFunctionData({
      abi,
      functionName: "liquidateWithPriceUpdate",
      args: [vault.id, vaas],
    });
    const permission = this.createPermission(vault.id);
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
    const opportunity: OpportunityCreate = {
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
    return opportunity;
  }

  private isLiquidatable(vault: VaultWithId): boolean {
    if (
      !this.prices[vault.tokenIdCollateral] ||
      !this.prices[vault.tokenIdDebt]
    ) {
      return false;
    }
    const priceCollateral = BigInt(
      this.prices[vault.tokenIdCollateral].getPriceUnchecked().price
    );
    const priceDebt = BigInt(
      this.prices[vault.tokenIdDebt].getPriceUnchecked().price
    );
    const valueCollateral = priceCollateral * vault.amountCollateral;
    const valueDebt = priceDebt * vault.amountDebt;
    if (valueDebt * vault.minHealthRatio > valueCollateral * 10n ** 18n) {
      const health = Number(valueCollateral) / Number(valueDebt);
      console.log(`Vault ${vault.id} is undercollateralized health: ${health}`);
      return true;
    }
    return false;
  }

  private createPermission(vaultId: bigint) {
    const permissionPayload = encodeAbiParameters(
      [{ type: "uint256", name: "vaultId" }],
      [vaultId]
    );
    const permission = encodeAbiParameters(
      [
        { type: "address", name: "contract" },
        { type: "bytes", name: "vaultId" },
      ],
      [this.vaultContract, permissionPayload]
    );
    return permission;
  }
}

const argv = yargs(hideBin(process.argv))
  .option("express-relay-endpoint", {
    description:
      "Express relay endpoint. e.g: https://per-staging.dourolabs.app/",
    type: "string",
    default: "https://per-staging.dourolabs.app/",
  })
  .option("pyth-endpoint", {
    description: "Pyth endpoint to use for fetching prices",
    type: "string",
    default: "https://hermes.pyth.network",
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
  .option("only-recent", {
    description:
      "Instead of checking all vaults, only check recent ones. Specify the number of recent vaults to check",
    type: "number",
  })
  .help()
  .alias("help", "h")
  .parseSync();

async function run() {
  const monitor = new ProtocolMonitor(
    argv.expressRelayEndpoint,
    argv.pythEndpoint,
    argv.chainId,
    checkAddress(argv.wethContract),
    checkAddress(argv.vaultContract),
    argv.onlyRecent
  );
  await monitor.start();
}

run();
