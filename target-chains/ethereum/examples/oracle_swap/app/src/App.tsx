import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import {Price, PriceFeed, EvmPriceServiceConnection, HexString} from "@pythnetwork/pyth-evm-js";
import IPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json"
import OracleSwapAbi from "./OracleSwapAbi.json";
import { useMetaMask } from "metamask-react";
import Web3 from "web3";

// Please read https://docs.pyth.network/consume-data before building on Pyth

// Rpc endpoint
const TESTNET_PRICE_SERVICE = "https://xc-testnet.pyth.network";
// const TESTNET_PRICE_SERVICE = "https://xc-mainnet.pyth.network";

// Connection
const testnetConnection = new EvmPriceServiceConnection(
  TESTNET_PRICE_SERVICE
); // Price service client used to retrieve the offchain VAAs to update the onchain price

// ETH/USD price id in testnet. You can find price feed ids at https://pyth.network/developers/price-feed-ids
const ETH_USD_TESTNET_PRICE_ID =
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6";

const PYTH_EXAMPLE_ADDRESS = "0x7B4b667F9B792054565e10656d1A08ECF50aa31C";
const PYTH_CONTRACT = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C";


const CONFIG = {
  baseToken: {
    name: "BRL",
    erc20Address: "",
    pythPriceFeedId: "08f781a893bc9340140c5f89c8a96f438bcfae4d1474cc0f688e3a52892c7318"
  },
  quoteToken: {
    name: "USDC",
    erc20Address: "",
    pythPriceFeedId: "41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722"
  }
}

function timeAgo(diff: number) {
  if (diff > 60) {
    return ">1m";
  } else if (diff < 2) {
    return "<2s";
  } else {
    return `${diff.toFixed(0)}s`;
  }
}

function PriceTicker(props: {price: Price | undefined, currentTime: Date}) {
  const price = props.price;

  if (price === undefined) {
    return (<span style={{color: "grey"}}>loading...</span>);
  } else {
    const now = props.currentTime.getTime() / 1000;

    return (<span><span style={{color: "green"}}>
                {" "}
      {price.getPriceAsNumberUnchecked().toFixed(3) +
          " ± " +
          price.getConfAsNumberUnchecked().toFixed(3)}{" "}
    </span><span style={{color: "grey"}}>last updated {timeAgo(now - price.publishTime)} ago</span></span>);
  }
}

/// React component that shows the offchain price and confidence interval
function PriceText(props: {price: Record<HexString, Price>, currentTime: Date}) {
  let basePrice = props.price[CONFIG.baseToken.pythPriceFeedId];
  let quotePrice = props.price[CONFIG.quoteToken.pythPriceFeedId];

  let exchangeRate: number | undefined = undefined
  if (basePrice !== undefined && quotePrice !== undefined) {
    exchangeRate = basePrice.getPriceAsNumberUnchecked() / quotePrice.getPriceAsNumberUnchecked()
  }

  return (
      <div>
        <p>
          Current Exchange Rate: {exchangeRate !== undefined ? exchangeRate.toFixed(4) : <span style={{color: "grey"}}>"loading"</span>}
          <br/>
          Current time: {props.currentTime.toISOString()}
          <br/>
          <br/>
          Pyth {CONFIG.baseToken.name} price:{" "}
          <PriceTicker price={basePrice} currentTime={props.currentTime}/>
          <br/>
          Pyth {CONFIG.quoteToken.name} price:{" "}
          <PriceTicker price={quotePrice} currentTime={props.currentTime}/>
          <br/>
        </p>
      </div>
  );
}

function App() {
  const { status, connect, account, ethereum } = useMetaMask();

  const [qty, setQty] = useState<string>("0");
  const [isBuy, setIsBuy] = useState<boolean>(true);

  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);

  useEffect(() => {
    if (status === "connected") {
      setWeb3(new Web3(ethereum))
    }
  }, [status]);

  const [pythOffChainPrice, setPythOffChainPrice] = useState<
    Record<HexString, Price>
  >({});

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  testnetConnection.subscribePriceFeedUpdates(
    [CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId],
    (priceFeed: PriceFeed) => {
      const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
      setPythOffChainPrice({
        ...pythOffChainPrice,
        [priceFeed.id]: price,
      });
    }
  );

  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>Swap between {CONFIG.baseToken.name} and {CONFIG.quoteToken.name}</p>
        <PriceText price={pythOffChainPrice} currentTime={time} />

        <div>
          <label>
            Your address: <br/> {account}
          </label>
          <button
              onClick={async () => {
                connect();
              }}
              disabled={status === "connected"}
          >
            {" "}
            Connect Wallet{" "}
          </button>
        </div>
        <div>
          <label>
            {isBuy ? "Buy" : "Sell"}
            <input type="text" name="base"
              value={qty}
              onChange={(event) => {
                  setQty(event.target.value);
                }
              } />
            {CONFIG.baseToken.name}
          </label>
        </div>

        <div>
          <button
            onClick={async () => {
              await sendSwapTx(web3!, account!, qty, isBuy);
            }}
            disabled={status !== "connected" || !pythOffChainPrice}
          >
            {" "}
            Swap!{" "}
          </button>{" "}
        </div>
      </header>
    </div>
  );
}

async function sendSwapTx(web3: Web3, sender: string, qty: string, isBuy: boolean) {
  // const priceFeed = (await testnetConnection.getLatestPriceFeeds([CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId]))![0];
  const priceFeedUpdateData = await testnetConnection.getPriceFeedsUpdateData([CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId]);

  const pythContract = new web3.eth.Contract(
    IPythAbi as any,
    PYTH_CONTRACT
  );

  const updateFee = await pythContract.methods
  .getUpdateFee(priceFeedUpdateData.length)
  .call();

  console.log(`Update fee: ${updateFee}`);

  const swapContract = new web3.eth.Contract(
    OracleSwapAbi as any,
    PYTH_EXAMPLE_ADDRESS
  );

  big

  10

  // Note: this shouldn't assume the token has 18 decimals
  await swapContract.methods
  .swap(isBuy, Number(qty) * 10**18, priceFeedUpdateData)
  .send({ value: updateFee , from: sender });
}

export default App;
