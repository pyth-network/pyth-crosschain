import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { Price, PriceFeed } from "@pythnetwork/pyth-common-js";
import { AptosClient } from "aptos";
import { AptosPriceServiceConnection } from "@pythnetwork/pyth-aptos-js";

// Please read https://docs.pyth.network/consume-data before building on Pyth

// Rpc endpoints
const TESTNET_PRICE_SERVICE = "https://xc-testnet.pyth.network";
const APTOS_TESTNET_RPC = "https://testnet.aptoslabs.com/";

// Connections
const testnetConnection = new AptosPriceServiceConnection(
  TESTNET_PRICE_SERVICE
); // Price service client used to retrieve the offchain VAAs to update the onchain price
const aptosClient = new AptosClient(APTOS_TESTNET_RPC); // Aptos client is used to retrieve onchain info. WARNING: Reading prices directly from aptos blockchain should never be done by a customer, as the price might be stale.

// Price id : this is not an aptos account but instead an opaque identifier for each price https://pyth.network/developers/price-feed-ids/#pyth-cross-chain-testnet
const ETH_USD_TESTNET_PRICE_ID =
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6";

// Aptos accounts : These are testnet addresses https://docs.pyth.network/consume-data/aptos#addresses
const PYTH_MODULE =
  "0xaa706d631cde8c634fe1876b0c93e4dec69d0c6ccac30a734e9e257042e81541";
const MINT_NFT_MODULE = "_";

function PriceText(props: { price: Price | undefined }) {
  let price = props.price;
  if (price) {
    return (
      <div>
        {" "}
        <p>
          {" "}
          Current ETH/USD price:{" "}
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
            {(100 / price.getPriceAsNumberUnchecked()).toFixed(5)} APT{" "}
          </span>{" "}
        </p>{" "}
      </div>
    );
  } else {
    return (
      <span style={{ color: "red" }}>
        {" "}
        Failed to fetch price or price outdated{" "}
      </span>
    );
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
  const [pythRecencyThreshold, setRecencyThreshold] = React.useState<number>(0);

  const getRecencyThreshold = async () => {
    let data = await aptosClient.getAccountResource(
      PYTH_MODULE,
      `${PYTH_MODULE}::state::StalePriceThreshold`
    );
    setRecencyThreshold((data.data as any).threshold_secs);
  };

  // Fetch onchain recency threshold when you land on the website. When using `pyth::get_price` the pyth module will abort if the price is older than `pythRecencyThreshold` seconds
  React.useEffect(() => {
    getRecencyThreshold();
  }, []);

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  testnetConnection.subscribePriceFeedUpdates(
    [ETH_USD_TESTNET_PRICE_ID],
    (priceFeed: PriceFeed) => {
      const price = priceFeed.getPriceNoOlderThan(pythRecencyThreshold); //This will return undefined if the offchain price is too old.
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
    ETH_USD_TESTNET_PRICE_ID,
  ]);
  const mintTransaction = {
    type: "entry_function_payload",
    function: MINT_NFT_MODULE + `::minting::mint_nft`,
    arguments: [priceFeedUpdateData], // Minting requires updating the price first, so we are passing the VAA containing the verifiable price as an argument. The mint_nft module will call pyth::pyth::update_price_feeds to update the price before paying the right amount for the mint.
    type_arguments: [],
  };
  await window.aptos.signAndSubmitTransaction(mintTransaction);
}

export default App;
