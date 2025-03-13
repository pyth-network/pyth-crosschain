import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";
import {
  PYTH_CONTRACT_ADDRESS_SEPOLIA,
  PYTH_CONTRACT_ABI,
  FUEL_ETH_ASSET_ID,
} from "../index";
import { Provider, Wallet, Contract, hexlify, arrayify } from "fuels";

async function main() {
  // Create a provider for interacting with Fuel RPC
  const provider = await Provider.create(
    "https://testnet.fuel.network/v1/graphql",
  );
  const privateKey = process.env.ACCOUNT_PRIVATE_KEY;
  if (privateKey === undefined) {
    throw new Error("Missing ACCOUNT_PRIVATE_KEY env var");
  }
  const wallet = Wallet.fromPrivateKey(privateKey, provider);

  // Create a `Contract` instance to interact with the Pyth contract on Fuel
  const contract = new Contract(
    PYTH_CONTRACT_ADDRESS_SEPOLIA,
    PYTH_CONTRACT_ABI,
    wallet,
  );

  const priceFeedSymbol = "Crypto.ETH/USD";
  const priceFeedId =
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"; // Pyth ETH/USD price feed id
  const previousPrice = (
    await contract.functions.price_unsafe(priceFeedId).get()
  ).value;
  console.log(
    `Previous price: ${
      previousPrice.price.toNumber() * 10 ** -previousPrice.exponent
    }`,
  );

  // Create a client for pulling price updates from Hermes.
  const hermesClient = new HermesClient("https://hermes.pyth.network");

  console.log(`Querying latest Pyth price update for ${priceFeedSymbol}`);
  // Get the latest values of the price feeds as json objects.
  const priceUpdates: PriceUpdate = await hermesClient.getLatestPriceUpdates([
    priceFeedId,
  ]);
  console.log(
    `Current price from Hermes: ${
      Number(priceUpdates.parsed?.[0].price.price) *
      10 ** Number(priceUpdates.parsed?.[0].price.expo)
    }`,
  );

  const priceFeedUpdateData = arrayify(
    Buffer.from(priceUpdates.binary.data[0], "hex"),
  );

  // Query the amount of update fee required
  console.log(`Querying update fee...`);
  const updateFee: number = (
    await contract.functions.update_fee([priceFeedUpdateData]).get()
  ).value;
  console.log(`Update fee: ${updateFee}`);

  const tx = await contract.functions
    .update_price_feeds([priceFeedUpdateData])
    .callParams({
      forward: [updateFee, hexlify(FUEL_ETH_ASSET_ID)],
    })
    .call();
  console.log(`Transaction confirmed: ${tx.transactionId}`);

  const newPrice = (
    await contract.functions.price_no_older_than(60, priceFeedId).get()
  ).value;
  console.log(
    `New price: ${newPrice.price.toNumber() * 10 ** -newPrice.exponent}`,
  );
}

main();
