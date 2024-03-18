import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { checkAddress, Client, OpportunityParams } from "../index";
import { privateKeyToAccount } from "viem/accounts";
import type { ContractFunctionReturnType } from "viem";
import {
  Address,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getContract,
  Hex,
  http,
  isHex,
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
    const vaults: VaultWithId[] = [];
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
      if (this.isLiquidatable(vault)) {
        const opportunity = this.createOpportunity(vault);
        await this.client.submitOpportunity(opportunity);
      }
    }
  }

  private createOpportunity(vault: VaultWithId) {
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
    const opportunity: OpportunityParams = {
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
      !this.prices[vault.tokenIDCollateral] ||
      !this.prices[vault.tokenIDDebt]
    ) {
      return false;
    }
    const priceCollateral = BigInt(
      this.prices[vault.tokenIDCollateral].getPriceUnchecked().price
    );
    const priceDebt = BigInt(
      this.prices[vault.tokenIDDebt].getPriceUnchecked().price
    );
    const valueCollateral = priceCollateral * vault.amountCollateral;
    const valueDebt = priceDebt * vault.amountDebt;
    if (valueDebt * vault.minHealthRatio > valueCollateral * 10n ** 18n) {
      const health = valueCollateral / valueDebt;
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
