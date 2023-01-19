import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { Price, PriceFeed, EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import IPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json"
import PythExampleAbi from "./PythExampleAbi.json";
import { useMetaMask } from "metamask-react";
import Web3 from "web3";

// Please read https://docs.pyth.network/consume-data before building on Pyth

// Rpc endpoint
const TESTNET_PRICE_SERVICE = "https://xc-testnet.pyth.network";

// Connection
const testnetConnection = new EvmPriceServiceConnection(
  TESTNET_PRICE_SERVICE
); // Price service client used to retrieve the offchain VAAs to update the onchain price

// ETH/USD price id in testnet. You can find price feed ids at https://pyth.network/developers/price-feed-ids
const ETH_USD_TESTNET_PRICE_ID =
  "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6";

const PYTH_EXAMPLE_ADDRESS = "0x7B4b667F9B792054565e10656d1A08ECF50aa31C";
const PYTH_CONTRACT = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C";

/// React component that shows the offchain price and confidence interval
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
          <br/>
          $5 is worth
          <span style={{ color: "red" }}>
            {" "}
            {(5/price.getPriceAsNumberUnchecked()).toFixed(10)}
            {" "}ETH
          </span>

        </p>
      </div>
    );
  } else {
    return <span style={{ color: "red" }}> Failed to fetch price </span>;
  }
}

function App() {
  const { status, connect, account, ethereum } = useMetaMask();

  const [toAddress, setToAddress] = React.useState<string>("0x753F219915E3416A0D2Baa400e418403407abECb");

  const [web3, setWeb3] = React.useState<Web3 | undefined>(undefined);

  useEffect(() => {
    if (status === "connected") {
      setWeb3(new Web3(ethereum))
    }
  }, [status]);

  const [pythOffChainPrice, setPythOffChainPrice] = React.useState<
    Price | undefined
  >(undefined);

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  testnetConnection.subscribePriceFeedUpdates(
    [ETH_USD_TESTNET_PRICE_ID],
    (priceFeed: PriceFeed) => {
      const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
      setPythOffChainPrice(price);
    }
  );

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Send $5 worth of ETH to a friend</p>
        <PriceText price={pythOffChainPrice} />

        <div>
          <label>
            Your address: <br/> {account}
          </label>
        </div>
        <div>
          <label>
            Your friend address:
            <br/>
            <input type="text" name="toAddress"
              value={toAddress}
              onChange={(event) => {
                  setToAddress(event.target.value);
                }
              } />
          </label>
        </div>

        <div>
          <button
            onClick={async () => {
              connect();
            }}
            disabled={status === "connected"}
          >
            {" "}
            Connect{" "}
          </button>
          <button
            onClick={async () => {
              await sendToFriend(account!, toAddress, web3!);
            }}
            disabled={status !== "connected" || !pythOffChainPrice}
          >
            {" "}
            Send{" "}
          </button>{" "}
        </div>
      </header>
    </div>
  );
}

async function sendToFriend(sender: string, friendAddress: string, web3: Web3) {
  const priceFeed = (await testnetConnection.getLatestPriceFeeds([ETH_USD_TESTNET_PRICE_ID]))![0];
  const priceFeedUpdateData = await testnetConnection.getPriceFeedsUpdateData([ETH_USD_TESTNET_PRICE_ID]);
  console.log(priceFeedUpdateData);

  const pythContract = new web3.eth.Contract(
    IPythAbi as any,
    PYTH_CONTRACT
  );

  const updateFee = await pythContract.methods
  .getUpdateFee(priceFeedUpdateData.length)
  .call();

  console.log(updateFee);

  const pythExampleContract = new web3.eth.Contract(
    PythExampleAbi as any,
    PYTH_EXAMPLE_ADDRESS
  );

  const estimatedWei = Math.ceil((5*10**18)/priceFeed.getPriceUnchecked().getPriceAsNumberUnchecked() + Number(updateFee));

  console.log(estimatedWei);

  await pythExampleContract.methods
  .sendToFriend(friendAddress, 5, priceFeedUpdateData)
  .send({ value: Number(updateFee) + estimatedWei, from: sender });
}

export default App;
