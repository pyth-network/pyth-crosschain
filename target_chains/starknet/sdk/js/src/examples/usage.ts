import { Account, Contract, RpcProvider, shortString } from "starknet";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  ByteBuffer,
  ERC20_ABI,
  STRK_TOKEN_ADDRESS,
  PYTH_ABI,
  PYTH_CONTRACT_ADDRESS_SEPOLIA,
} from "..";

async function main() {
  // Create a provider for interacting with Starknet RPC.
  const provider = new RpcProvider({
    nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_6",
  });
  console.log(
    "chain id: ",
    shortString.decodeShortString(await provider.getChainId())
  );
  console.log("rpc version: ", await provider.getSpecVersion());

  // Create a `Contract` instance to interact with a fee token contract on Starknet
  // (you can use either STRK or ETH to pay fees, but using STRK is recommended).
  const strkErc0Contract = new Contract(
    ERC20_ABI,
    STRK_TOKEN_ADDRESS,
    provider
  );

  // Create a `Contract` instance to interact with the Pyth contract on Starknet.
  const pythContract = new Contract(
    PYTH_ABI,
    PYTH_CONTRACT_ADDRESS_SEPOLIA,
    provider
  );
  const chain_id = await pythContract.chain_id();
  console.log("pyth chain id:", chain_id);

  const version = await pythContract.version();
  console.log("pyth version:", shortString.decodeShortString(version));

  // Import your account data from environment variables.
  // You'll need to set them before running the code.
  const privateKey0 = process.env.ACCOUNT_PRIVATE_KEY;
  if (privateKey0 === undefined) {
    throw new Error("missing ACCOUNT_PRIVATE_KEY");
  }
  const account0Address = process.env.ACCOUNT_ADDRESS;
  if (account0Address === undefined) {
    throw new Error("missing ACCOUNT_ADDRESS");
  }
  const account0 = new Account(provider, account0Address, privateKey0);

  const balanceInitial = await strkErc0Contract.balanceOf(account0Address);
  console.log("account0 balance:", balanceInitial);

  // Create a client for pulling price updates from Hermes.
  const connection = new PriceServiceConnection("https://hermes.pyth.network", {
    priceFeedRequestConfig: {
      // Provide this option to retrieve signed price updates for on-chain contracts.
      // Ignore this option for off-chain use.
      binary: true,
    },
  });

  const priceFeedId =
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"; // ETH/USD
  const previousPrice = await pythContract.get_price_unsafe(priceFeedId);
  console.log("previous price:", previousPrice);

  console.log("querying pyth update");
  // Get the latest values of the price feeds as json objects.
  const currentPrices = await connection.getLatestPriceFeeds([priceFeedId]);
  if (currentPrices === undefined) {
    throw new Error("failed to get prices");
  }
  console.log("current price:", currentPrices[0]);

  if (!currentPrices[0].vaa) {
    throw new Error("missing vaa in response");
  }

  // Convert the price update to Starknet format.
  const pythUpdate = ByteBuffer.fromHex(currentPrices[0].vaa);

  // Query the amount of fee required by Pyth.
  console.log("querying pyth fee");
  const fee = await pythContract.get_update_fee(
    pythUpdate,
    strkErc0Contract.address
  );
  console.log("pyth fee:", fee);

  // Approve fee withdrawal.
  console.log("approving fee");
  strkErc0Contract.connect(account0);
  let tx = await strkErc0Contract.approve(pythContract.address, fee);
  console.log("waiting for tx");
  await provider.waitForTransaction(tx.transaction_hash);

  pythContract.connect(account0);

  // Create a transaction and submit to your contract using the price update data.
  console.log("updating price feeds");
  tx = await pythContract.update_price_feeds(pythUpdate);
  console.log("waiting for tx");
  await provider.waitForTransaction(tx.transaction_hash);
  console.log("transaction confirmed:", tx.transaction_hash);

  const newPrice = await pythContract.get_price_no_older_than(priceFeedId, 60);
  console.log("new price:", newPrice);
}

main();
