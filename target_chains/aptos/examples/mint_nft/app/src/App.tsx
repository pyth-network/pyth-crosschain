import { AptosPriceServiceConnection } from "@pythnetwork/pyth-aptos-js";
import { Price, PriceFeed } from "@pythnetwork/pyth-common-js";
import React from "react";
import "./App.css";
import logo from "./logo.svg";

// Please read https://docs.pyth.network/documentation/pythnet-price-feeds before building on Pyth

// Rpc endpoint
const TESTNET_HERMES_ENDPOINT = "https://hermes-beta.pyth.network";

// Connection
const testnetConnection = new AptosPriceServiceConnection(
  TESTNET_HERMES_ENDPOINT
); // Price service client used to retrieve the offchain VAAs to update the onchain price

// Price id : this is not an aptos account but instead an opaque identifier for each price https://pyth.network/developers/price-feed-ids/#pyth-cross-chain-testnet
const APT_USD_TESTNET_PRICE_ID =
  "0x44a93dddd8effa54ea51076c4e851b6cbbfd938e82eb90197de38fe8876bb66e";

// Aptos modules : These are testnet addresses https://docs.pyth.network/documentation/pythnet-price-feeds/aptos
const MINT_NFT_MODULE =
  "0x19f8503273cdb5aa93ffe4539277684615242127aa2e65ef91424136a316c9c7";

/// React component that shows the offchain price and confidence interval
function PriceText(props: { price: Price | undefined }) {
  let price = props.price;
  if (price) {
    return (
      <div>
        {" "}
        <p>
          {" "}
          Current APT/USD price:{" "}
          <span style={{ color: "green" }}>
            {" "}
            {price.getPriceAsNumberUnchecked().toFixed(3) +
              " ± " +
              price.getConfAsNumberUnchecked().toFixed(3)}{" "}
          </span>
        </p>
        <p>
          {" "}
          Current NFT price:{" "}
          <span style={{ color: "green" }}>
            {" "}
            {(1 / price.getPriceAsNumberUnchecked()).toFixed(5)} APT{" "}
          </span>{" "}
        </p>{" "}
      </div>
    );
  } else {
    return <span style={{ color: "red" }}> Failed to fetch price </span>;
  }
}

function App() {
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

  // Disconnect right at the beginning to clear previous wallet connections
  React.useEffect(() => {
    window.aptos.disconnect();
  }, []);

  const [pythOffChainPrice, setPythOffChainPrice] = React.useState<
    Price | undefined
  >(undefined);

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  testnetConnection.subscribePriceFeedUpdates(
    [APT_USD_TESTNET_PRICE_ID],
    (priceFeed: PriceFeed) => {
      const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
      setPythOffChainPrice(price);
    }
  );

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Mint your Pythian NFT</p>
        <PriceText price={pythOffChainPrice} />

        <div>
          <button
            onClick={async () => {
              setIsConnected(true);
              await window.aptos.connect();
            }}
            disabled={isConnected}
          >
            {" "}
            Connect{" "}
          </button>
          <button
            onClick={async () => {
              setIsConnected(false);
              await window.aptos.disconnect();
            }}
            disabled={!isConnected}
          >
            {" "}
            Disconnect{" "}
          </button>
          <button
            onClick={async () => {
              await sendMintTransaction();
            }}
            disabled={!isConnected || !pythOffChainPrice}
          >
            {" "}
            Mint{" "}
          </button>{" "}
        </div>
      </header>
    </div>
  );
}

async function sendMintTransaction() {
  const priceFeedUpdateData = await testnetConnection.getPriceFeedsUpdateData([
    APT_USD_TESTNET_PRICE_ID,
  ]);
  const mintTransaction = {
    type: "entry_function_payload",
    function: MINT_NFT_MODULE + `::minting::mint_nft`,
    arguments: [priceFeedUpdateData], // Minting requires updating the price first, so we are passing the VAA containing the verifiable price as an argument. The `mint_nft` module use the VAA to update the Pyth price before the caller pays for the mint.
    type_arguments: [],
  };
  await window.aptos.signAndSubmitTransaction(mintTransaction);
}

export default App;
