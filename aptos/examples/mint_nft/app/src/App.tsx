import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { PriceFeed } from "@pythnetwork/pyth-common-js";
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
const aptosClient = new AptosClient(APTOS_TESTNET_RPC); // Aptos client is used to retrieve onchain prices

// Price id : this is not an aptos account but instead an opaque identifier for each price https://pyth.network/developers/price-feed-ids/#pyth-cross-chain-testnet
const ETH_USD_TESTNET_PRICE_ID =
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6";

// Aptos accounts : These are testnet addresses https://docs.pyth.network/consume-data/aptos#addresses
const PYTH_MODULE =
  "0xaa706d631cde8c634fe1876b0c93e4dec69d0c6ccac30a734e9e257042e81541";
const PYTH_TABLE_HANDLE =
  "0x21b2122f77d3f9f944456c0ca8ffa6a13c541476433e64ab6ae81d48277a1181"; // The prices are stored in this table. WARNING : Consumers should not access this table in frontend code and should instead get the prices from the price service.
const MINT_NFT_MODULE =
  "0x122f1cd6062f72a12a5755d6bbf590ee9ae31ba5a12ce60f7f6aea1967e1c02b";

function RecentText(props: { isRecent: boolean }) {
  const isRecent = props.isRecent;
  if (isRecent) {
    return <span style={{ color: "green" }}> Recent </span>;
  }
  return <span style={{ color: "red" }}> Outdated </span>;
}

function App() {
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

  React.useEffect(() => {
    window.aptos.disconnect();
  }, []);

  const [pythOffChainPrice, setPythOffChainPrice] = React.useState<number>(0);
  const [pythOnChainPrice, setPythOnChainPrice] = React.useState<number>(0);
  const [pythOffChainPublishTimestamp, setPythOffChainPublishTimestamp] =
    React.useState<number>(0);
  const [pythOnChainPublishTimestamp, setPythOnChainPublishTimestamp] =
    React.useState<number>(0);
  const [pythRecencyThreshold, setRecencyThreshold] = React.useState<number>(0);
  const [onChainPriceIsRecent, setOnchainPriceRecent] =
    React.useState<boolean>(false);
  const [offChainPriceIsRecent, setOffchainPriceRecent] =
    React.useState<boolean>(false);

  // Reading directly from the table should never be done by a consumer, as this bypasses our recency checks
  // We're doing it here to highlight the inner workings of Pyth
  const fetchOnChainPrice = async () => {
    let data = await aptosClient.getTableItem(PYTH_TABLE_HANDLE, {
      key_type: `${PYTH_MODULE}::price_identifier::PriceIdentifier`,
      value_type: `${PYTH_MODULE}::price_info::PriceInfo`,
      key: {
        bytes: ETH_USD_TESTNET_PRICE_ID,
      },
    });
    setPythOnChainPrice(
      data.price_feed.price.price.magnitude *
        10 ** -data.price_feed.price.expo.magnitude
    );
    setPythOnChainPublishTimestamp(data.price_feed.price.timestamp);
  };

  // Fetch onchain price when you land on the website
  React.useEffect(() => {
    fetchOnChainPrice();
  }, []);

  const getRecencyThreshold = async () => {
    let data = await aptosClient.getAccountResource(
      PYTH_MODULE,
      `${PYTH_MODULE}::state::StalePriceThreshold`
    );
    setRecencyThreshold((data.data as any).threshold_secs);
  };
  // Fetch onchain recency threshold when you land on the website
  React.useEffect(() => {
    getRecencyThreshold();
  }, []);

  // Subscribe to offchain prices
  testnetConnection.subscribePriceFeedUpdates(
    [ETH_USD_TESTNET_PRICE_ID],
    (priceFeed: PriceFeed) => {
      setPythOffChainPrice(
        priceFeed.getPriceUnchecked()?.getPriceAsNumberUnchecked() || 0
      );
      setPythOffChainPublishTimestamp(
        priceFeed.getPriceUnchecked()?.publishTime || 0
      );
    }
  );

  // Check recency of the prices
  React.useEffect(() => {
    const interval = setInterval(() => {
      setOnchainPriceRecent(
        Date.now() / 1000 - pythOnChainPublishTimestamp < pythRecencyThreshold
      );
      setOffchainPriceRecent(
        Date.now() / 1000 - pythOffChainPublishTimestamp < pythRecencyThreshold
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [pythOnChainPrice, pythOffChainPrice, pythOffChainPrice]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Mint your Pythian NFT</p>
        <p>
          Current offchain ETH/USD : {pythOffChainPrice.toFixed(3)}{" "}
          <RecentText isRecent={offChainPriceIsRecent} />
        </p>
        <p>Current NFT price : {(100 / pythOffChainPrice).toFixed(5)} APT</p>
        <p>
          Onchain ETH/USD : {pythOnChainPrice.toFixed(3)}{" "}
          <RecentText isRecent={onChainPriceIsRecent} />{" "}
        </p>
        <div>
          <button
            onClick={async () => {
              await sendRefreshPriceTransaction();
              await new Promise((res) => setTimeout(res, 5000));
              await fetchOnChainPrice();
            }}
            disabled={!isConnected}
          >
            {" "}
            Refresh onchain price{" "}
          </button>
          <button
            onClick={async () => {
              setIsConnected(true);
              await window.aptos.connect();
              await window.aptos.isConnected();
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
              await new Promise((res) => setTimeout(res, 5000));
              await fetchOnChainPrice();
            }}
            disabled={!isConnected}
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
    arguments: [priceFeedUpdateData], // Minting requires updating the price first, so we are passing the VAA containing the verifiable price as an argument
    type_arguments: [],
  };
  await window.aptos.signAndSubmitTransaction(mintTransaction);
}

async function sendRefreshPriceTransaction() {
  const priceFeedUpdateData = await testnetConnection.getPriceFeedsUpdateData([
    ETH_USD_TESTNET_PRICE_ID,
  ]);

  const priceRefreshInstruction = {
    type: "entry_function_payload",
    function: PYTH_MODULE + `::pyth::update_price_feeds_with_funder`,
    arguments: [priceFeedUpdateData], // VAA to update and verify the price
    type_arguments: [],
  };
  await window.aptos.signAndSubmitTransaction(priceRefreshInstruction);
}

export default App;
