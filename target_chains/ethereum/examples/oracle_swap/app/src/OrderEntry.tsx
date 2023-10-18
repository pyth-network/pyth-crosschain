import React, { useEffect, useState } from "react";
import "./App.css";
import Web3 from "web3";
import { BigNumber } from "ethers";
import { TokenConfig, numberToTokenQty, tokenQtyToNumber } from "./utils";
import IPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import OracleSwapAbi from "./abi/OracleSwapAbi.json";
import { approveToken, getApprovedQuantity } from "./erc20";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";

/**
 * The order entry component lets users enter a quantity of the base token to buy/sell and submit
 * the transaction to the blockchain.
 */
export function OrderEntry(props: {
  web3: Web3 | undefined;
  account: string | null;
  isBuy: boolean;
  approxPrice: number | undefined;
  baseToken: TokenConfig;
  quoteToken: TokenConfig;
  hermesUrl: string;
  pythContractAddress: string;
  swapContractAddress: string;
}) {
  const [qty, setQty] = useState<string>("1");
  const [qtyBn, setQtyBn] = useState<BigNumber | undefined>(
    BigNumber.from("1")
  );
  const [authorizedQty, setAuthorizedQty] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  const [spentToken, setSpentToken] = useState<TokenConfig>(props.baseToken);
  const [approxQuoteSize, setApproxQuoteSize] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    if (props.isBuy) {
      setSpentToken(props.quoteToken);
    } else {
      setSpentToken(props.baseToken);
    }
  }, [props.isBuy, props.baseToken, props.quoteToken]);

  useEffect(() => {
    async function helper() {
      if (props.web3 !== undefined && props.account !== null) {
        setAuthorizedQty(
          await getApprovedQuantity(
            props.web3!,
            spentToken.erc20Address,
            props.account!,
            props.swapContractAddress
          )
        );
      } else {
        setAuthorizedQty(BigNumber.from("0"));
      }
    }

    helper();
    const interval = setInterval(helper, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [props.web3, props.account, props.swapContractAddress, spentToken]);

  useEffect(() => {
    try {
      const qtyBn = numberToTokenQty(qty, props.baseToken.decimals);
      setQtyBn(qtyBn);
    } catch (error) {
      setQtyBn(undefined);
    }
  }, [props.baseToken.decimals, qty]);

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
        tokenQtyToNumber(qtyBn, props.baseToken.decimals) * props.approxPrice
      );
    } else {
      setApproxQuoteSize(undefined);
    }
  }, [props.approxPrice, props.baseToken.decimals, qtyBn]);

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
          {props.baseToken.name}
        </p>
        {qtyBn !== undefined && approxQuoteSize !== undefined ? (
          props.isBuy ? (
            <p>
              Pay {approxQuoteSize.toFixed(3)} {props.quoteToken.name} to
              receive{" "}
              {tokenQtyToNumber(qtyBn, props.baseToken.decimals).toFixed(3)}{" "}
              {props.baseToken.name}
            </p>
          ) : (
            <p>
              Pay {tokenQtyToNumber(qtyBn, props.baseToken.decimals).toFixed(3)}{" "}
              {props.baseToken.name} to receive {approxQuoteSize.toFixed(3)}{" "}
              {props.quoteToken.name}
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
                  props.account!,
                  props.swapContractAddress
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
                  props.hermesUrl,
                  props.baseToken.pythPriceFeedId,
                  props.quoteToken.pythPriceFeedId,
                  props.pythContractAddress,
                  props.swapContractAddress,
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

async function sendSwapTx(
  web3: Web3,
  hermesUrl: string,
  baseTokenPriceFeedId: string,
  quoteTokenPriceFeedId: string,
  pythContractAddress: string,
  swapContractAddress: string,
  sender: string,
  qtyWei: BigNumber,
  isBuy: boolean
) {
  const pythPriceService = new EvmPriceServiceConnection(hermesUrl);
  const priceFeedUpdateData = await pythPriceService.getPriceFeedsUpdateData([
    baseTokenPriceFeedId,
    quoteTokenPriceFeedId,
  ]);

  const pythContract = new web3.eth.Contract(
    IPythAbi as any,
    pythContractAddress
  );

  const updateFee = await pythContract.methods
    .getUpdateFee(priceFeedUpdateData)
    .call();

  const swapContract = new web3.eth.Contract(
    OracleSwapAbi as any,
    swapContractAddress
  );

  await swapContract.methods
    .swap(isBuy, qtyWei, priceFeedUpdateData)
    .send({ value: updateFee, from: sender });
}
