import React, { useState, useEffect } from "react";
import "./App.css";
import {
  Price,
  PriceFeed,
  EvmPriceServiceConnection,
  HexString,
} from "@pythnetwork/pyth-evm-js";
import IPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import OracleSwapAbi from "./abi/OracleSwapAbi.json";
import ERC20Abi from "./abi/ERC20MockAbi.json";
import { useMetaMask } from "metamask-react";
import Web3 from "web3";
import { BigNumber } from "ethers";

const CONFIG = {
  // Each token is configured with its ERC20 contract address and Pyth Price Feed ID.
  // You can find the list of price feed ids at https://pyth.network/developers/price-feed-ids
  // Note that feeds have different ids on testnet / mainnet.
  baseToken: {
    name: "BRL",
    erc20Address: "0x8e2a09b54fF35Cc4fe3e7dba68bF4173cC559C69",
    pythPriceFeedId:
      "08f781a893bc9340140c5f89c8a96f438bcfae4d1474cc0f688e3a52892c7318",
    decimals: 18,
  },
  quoteToken: {
    name: "USDC",
    erc20Address: "0x98cDc14fe999435F3d4C2E65eC8863e0d70493Df",
    pythPriceFeedId:
      "41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
    decimals: 18,
  },
  swapContractAddress: "0xf3161b2B32761B46C084a7e1d8993C19703C09e7",
  pythContractAddress: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  priceServiceUrl: "https://xc-testnet.pyth.network",
  mintQty: 100,
};

export interface TokenConfig {
  name: string;
  erc20Address: string;
  pythPriceFeedId: string;
  decimals: number;
}

export interface ExchangeRateMeta {
  rate: number;
  lastUpdatedTime: Date;
}

export interface ChainState {
  accountBaseBalance: BigNumber;
  accountQuoteBalance: BigNumber;
  poolBaseBalance: BigNumber;
  poolQuoteBalance: BigNumber;
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

function MintButton(props: {
  web3: Web3;
  sender: string;
  erc20Address: string;
  destination: string;
  qty: number;
  decimals: number;
}) {
  return (
    <button
      onClick={async () => {
        await mint(
          props.web3,
          props.sender,
          props.erc20Address,
          props.destination,
          numberToTokenQty(props.qty, props.decimals)
        );
      }}
    >
      Mint {CONFIG.mintQty}
    </button>
  );
}

function PriceTicker(props: {
  price: Price | undefined;
  currentTime: Date;
  tokenName: string;
}) {
  const price = props.price;

  if (price === undefined) {
    return <span style={{ color: "grey" }}>loading...</span>;
  } else {
    const now = props.currentTime.getTime() / 1000;

    return (
      <div>
        <p>
          Pyth {props.tokenName} price:{" "}
          <span style={{ color: "green" }}>
            {" "}
            {price.getPriceAsNumberUnchecked().toFixed(3) +
              " ± " +
              price.getConfAsNumberUnchecked().toFixed(3)}{" "}
          </span>
        </p>
        <p>
          <span style={{ color: "grey" }}>
            last updated {timeAgo(now - price.publishTime)} ago
          </span>
        </p>
      </div>
    );
  }
}

/// React component that shows the offchain price and confidence interval
function PriceText(props: {
  rate: ExchangeRateMeta | undefined;
  price: Record<HexString, Price>;
  currentTime: Date;
}) {
  let basePrice = props.price[CONFIG.baseToken.pythPriceFeedId];
  let quotePrice = props.price[CONFIG.quoteToken.pythPriceFeedId];

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      {props.rate !== undefined ? (
        <div>
          Current Exchange Rate:{" "}
          <span className={"exchange-rate"}>{props.rate.rate.toFixed(4)}</span>{" "}
          <span
            className="icon-container"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            (details)
            {showTooltip && (
              <div className="tooltip">
                <PriceTicker
                  price={basePrice}
                  currentTime={props.currentTime}
                  tokenName={CONFIG.baseToken.name}
                />
                <PriceTicker
                  price={quotePrice}
                  currentTime={props.currentTime}
                  tokenName={CONFIG.quoteToken.name}
                />
              </div>
            )}
          </span>
          <p className={"last-updated"}>
            Last updated{" "}
            {timeAgo(
              (props.currentTime.getTime() -
                props.rate.lastUpdatedTime.getTime()) /
                1000
            )}{" "}
            ago
          </p>
        </div>
      ) : (
        <div>
          <p>Exchange rate is loading...</p>
        </div>
      )}
    </div>
  );
}

function OrderEntry(props: {
  web3: Web3 | undefined;
  account: string | null;
  isBuy: boolean;
  approxPrice: number | undefined;
}) {
  const [qty, setQty] = useState<string>("1");
  const [qtyBn, setQtyBn] = useState<BigNumber | undefined>(
    BigNumber.from("1")
  );
  const [authorizedQty, setAuthorizedQty] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  const [spentToken, setSpentToken] = useState<TokenConfig>(CONFIG.baseToken);
  const [approxQuoteSize, setApproxQuoteSize] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    if (props.isBuy) {
      setSpentToken(CONFIG.quoteToken);
    } else {
      setSpentToken(CONFIG.baseToken);
    }
  }, [props.isBuy]);

  useEffect(() => {
    async function helper() {
      if (props.web3 !== undefined && props.account !== null) {
        setAuthorizedQty(
          await getApprovedQuantity(
            props.web3!,
            spentToken.erc20Address,
            props.account!
          )
        );
      } else {
        setAuthorizedQty(BigNumber.from("0"));
      }
    }

    helper();
  }, [props.web3, props.account, spentToken]);

  useEffect(() => {
    try {
      const qtyBn = numberToTokenQty(qty, CONFIG.baseToken.decimals);
      setQtyBn(qtyBn);
    } catch (error) {
      setQtyBn(undefined);
    }
  }, [qty]);

  useEffect(() => {
    if (qtyBn !== undefined) {
      setIsAuthorized(authorizedQty.gte(qtyBn));
    } else {
      setIsAuthorized(false);
    }
  }, [qtyBn, authorizedQty]);

  useEffect(() => {
    if (qtyBn !== undefined && props.approxPrice !== undefined) {
      setApproxQuoteSize(
        tokenQtyToNumber(qtyBn, CONFIG.baseToken.decimals) * props.approxPrice
      );
    } else {
      setApproxQuoteSize(undefined);
    }
  }, [props.approxPrice, qtyBn]);

  return (
    <div>
      <div>
        <p>
          {props.isBuy ? "Buy" : "Sell"}
          <input
            type="text"
            name="base"
            value={qty}
            onChange={(event) => {
              setQty(event.target.value);
            }}
          />
          {CONFIG.baseToken.name}
        </p>
        {qtyBn !== undefined && approxQuoteSize !== undefined ? (
          props.isBuy ? (
            <p>
              Pay {approxQuoteSize.toFixed(3)} {CONFIG.quoteToken.name} to
              receive{" "}
              {tokenQtyToNumber(qtyBn, CONFIG.baseToken.decimals).toFixed(3)}{" "}
              {CONFIG.baseToken.name}
            </p>
          ) : (
            <p>
              Pay{" "}
              {tokenQtyToNumber(qtyBn, CONFIG.baseToken.decimals).toFixed(3)}{" "}
              {CONFIG.baseToken.name} to receive {approxQuoteSize.toFixed(3)}{" "}
              {CONFIG.quoteToken.name}
            </p>
          )
        ) : (
          <p>Transaction details are loading...</p>
        )}
      </div>

      <div className={"swap-steps"}>
        {props.account === null || props.web3 === undefined ? (
          <div>Connect your wallet to swap</div>
        ) : (
          <div>
            1.{" "}
            <button
              onClick={async () => {
                await approveToken(
                  props.web3!,
                  spentToken.erc20Address,
                  props.account!
                );
              }}
              disabled={isAuthorized}
            >
              {" "}
              Approve{" "}
            </button>
            2.
            <button
              onClick={async () => {
                await sendSwapTx(
                  props.web3!,
                  props.account!,
                  qtyBn!,
                  props.isBuy
                );
              }}
              disabled={!isAuthorized}
            >
              {" "}
              Submit{" "}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const { status, connect, account, ethereum } = useMetaMask();

  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);

  useEffect(() => {
    if (status === "connected") {
      setWeb3(new Web3(ethereum));
    }
  }, [status]);

  const [chainState, setChainState] = useState<ChainState | undefined>(
    undefined
  );

  useEffect(() => {
    async function refreshChainState() {
      if (web3 !== undefined && account !== null) {
        setChainState({
          accountBaseBalance: await getBalance(
            web3,
            CONFIG.baseToken.erc20Address,
            account
          ),
          accountQuoteBalance: await getBalance(
            web3,
            CONFIG.quoteToken.erc20Address,
            account
          ),
          poolBaseBalance: await getBalance(
            web3,
            CONFIG.baseToken.erc20Address,
            CONFIG.swapContractAddress
          ),
          poolQuoteBalance: await getBalance(
            web3,
            CONFIG.quoteToken.erc20Address,
            CONFIG.swapContractAddress
          ),
        });
      } else {
        setChainState(undefined);
      }
    }

    const interval = setInterval(refreshChainState, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [web3, account]);

  const [pythOffChainPrice, setPythOffChainPrice] = useState<
    Record<HexString, Price>
  >({});

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  useEffect(() => {
    // The Pyth price service client is used to retrieve the current Pyth prices and the price update data that
    // needs to be posted on-chain with each transaction.
    const pythPriceService = new EvmPriceServiceConnection(
      CONFIG.priceServiceUrl
    );

    pythPriceService.subscribePriceFeedUpdates(
      [CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId],
      (priceFeed: PriceFeed) => {
        const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
        setPythOffChainPrice({
          ...pythOffChainPrice,
          [priceFeed.id]: price,
        });
      }
    );

    return () => {
      pythPriceService.closeWebSocket();
    };
  }, [pythOffChainPrice]);

  const [exchangeRateMeta, setExchangeRateMeta] = useState<
    ExchangeRateMeta | undefined
  >(undefined);

  useEffect(() => {
    let basePrice = pythOffChainPrice[CONFIG.baseToken.pythPriceFeedId];
    let quotePrice = pythOffChainPrice[CONFIG.quoteToken.pythPriceFeedId];

    if (basePrice !== undefined && quotePrice !== undefined) {
      const exchangeRate =
        basePrice.getPriceAsNumberUnchecked() /
        quotePrice.getPriceAsNumberUnchecked();
      const lastUpdatedTime = new Date(
        Math.max(basePrice.publishTime, quotePrice.publishTime) * 1000
      );
      setExchangeRateMeta({ rate: exchangeRate, lastUpdatedTime });
    } else {
      setExchangeRateMeta(undefined);
    }
  }, [pythOffChainPrice]);

  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const [isBuy, setIsBuy] = useState<boolean>(true);

  return (
    <div className="App">
      <div className="control-panel">
        <h3>Control Panel</h3>

        <div>
          {status === "connected" ? (
            <label>
              Connected Wallet: <br /> {account}
            </label>
          ) : (
            <button
              onClick={async () => {
                connect();
              }}
            >
              {" "}
              Connect Wallet{" "}
            </button>
          )}
        </div>

        <div>
          <h3>Wallet Balances</h3>
          {chainState !== undefined ? (
            <div>
              <p>
                {tokenQtyToNumber(
                  chainState.accountBaseBalance,
                  CONFIG.baseToken.decimals
                )}{" "}
                {CONFIG.baseToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.baseToken.erc20Address}
                  destination={account!}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.baseToken.decimals}
                />
              </p>
              <p>
                {tokenQtyToNumber(
                  chainState.accountQuoteBalance,
                  CONFIG.quoteToken.decimals
                )}{" "}
                {CONFIG.quoteToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.quoteToken.erc20Address}
                  destination={account!}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.quoteToken.decimals}
                />
              </p>
            </div>
          ) : (
            <p>loading...</p>
          )}
        </div>

        <h3>AMM Balances</h3>
        <div>
          <p>Contract address: {CONFIG.swapContractAddress}</p>
          {chainState !== undefined ? (
            <div>
              <p>
                {tokenQtyToNumber(
                  chainState.poolBaseBalance,
                  CONFIG.baseToken.decimals
                )}{" "}
                {CONFIG.baseToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.baseToken.erc20Address}
                  destination={CONFIG.swapContractAddress}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.baseToken.decimals}
                />
              </p>
              <p>
                {tokenQtyToNumber(
                  chainState.poolQuoteBalance,
                  CONFIG.quoteToken.decimals
                )}{" "}
                {CONFIG.quoteToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.quoteToken.erc20Address}
                  destination={CONFIG.swapContractAddress}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.quoteToken.decimals}
                />
              </p>
            </div>
          ) : (
            <p>loading...</p>
          )}
        </div>
      </div>

      <div className={"main"}>
        <h3>
          Swap between {CONFIG.baseToken.name} and {CONFIG.quoteToken.name}
        </h3>
        <PriceText
          price={pythOffChainPrice}
          currentTime={time}
          rate={exchangeRateMeta}
        />
        <div className="tab-header">
          <div
            className={`tab-item ${isBuy ? "active" : ""}`}
            onClick={() => setIsBuy(true)}
          >
            Buy
          </div>
          <div
            className={`tab-item ${!isBuy ? "active" : ""}`}
            onClick={() => setIsBuy(false)}
          >
            Sell
          </div>
        </div>
        <div className="tab-content">
          {isBuy && (
            <OrderEntry
              web3={web3}
              account={account}
              isBuy={isBuy}
              approxPrice={exchangeRateMeta?.rate}
            />
          )}
          {!isBuy && (
            <OrderEntry
              web3={web3}
              account={account}
              isBuy={isBuy}
              approxPrice={exchangeRateMeta?.rate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

async function approveToken(web3: Web3, erc20Address: string, sender: string) {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);

  await erc20.methods
    .approve(CONFIG.swapContractAddress, BigNumber.from("2").pow(256).sub(1))
    .send({ from: sender });
}

async function getApprovedQuantity(
  web3: Web3,
  erc20Address: string,
  sender: string
): Promise<BigNumber> {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  let allowance = BigNumber.from(
    await erc20.methods.allowance(sender, CONFIG.swapContractAddress).call()
  );
  return allowance as BigNumber;
}

async function getBalance(
  web3: Web3,
  erc20Address: string,
  address: string
): Promise<BigNumber> {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  return BigNumber.from(await erc20.methods.balanceOf(address).call());
}

async function mint(
  web3: Web3,
  sender: string,
  erc20Address: string,
  destinationAddress: string,
  quantity: BigNumber
) {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  await erc20.methods.mint(destinationAddress, quantity).send({ from: sender });
}

async function sendSwapTx(
  web3: Web3,
  sender: string,
  qtyWei: BigNumber,
  isBuy: boolean
) {
  const pythPriceService = new EvmPriceServiceConnection(
    CONFIG.priceServiceUrl
  );
  const priceFeedUpdateData = await pythPriceService.getPriceFeedsUpdateData([
    CONFIG.baseToken.pythPriceFeedId,
    CONFIG.quoteToken.pythPriceFeedId,
  ]);

  const pythContract = new web3.eth.Contract(
    IPythAbi as any,
    CONFIG.pythContractAddress
  );

  const updateFee = await pythContract.methods
    .getUpdateFee(priceFeedUpdateData.length)
    .call();

  const swapContract = new web3.eth.Contract(
    OracleSwapAbi as any,
    CONFIG.swapContractAddress
  );

  await swapContract.methods
    .swap(isBuy, qtyWei, priceFeedUpdateData)
    .send({ value: updateFee, from: sender });
}

// Hacky function for converting a floating point number into a token quantity that's useful for ETH or ERC-20 tokens.
// Note: this function assumes that decimals >= 6 (which is pretty much always the case for tokens)
function numberToTokenQty(x: number | string, decimals: number): BigNumber {
  if (typeof x == "string") {
    x = Number.parseFloat(x);
  }
  return BigNumber.from(Math.floor(x * 1000000)).mul(
    BigNumber.from(10).pow(decimals - 6)
  );
}

// Hacky function for converting a token quantity back into a floating point number.
// Note: this function assumes that decimals >= 6 (which is pretty much always the case for tokens)
function tokenQtyToNumber(x: BigNumber, decimals: number): number {
  const divided = x.div(BigNumber.from(10).pow(decimals - 6));

  return divided.toNumber() / 1000000;
}

export default App;
