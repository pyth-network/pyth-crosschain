import type { paths } from "./types";
import createClient, { ClientOptions } from "openapi-fetch";
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  Hex,
  isAddress,
  isHex,
  keccak256,
} from "viem";
import { privateKeyToAccount, sign, signatureToHex } from "viem/accounts";

/**
 * ERC20 token with contract address and amount
 */
export type TokenQty = {
  contract: Address;
  amount: bigint;
};

/**
 * Bid information
 */
export type BidInfo = {
  /**
   * Bid amount in wei
   */
  amount: bigint;
  /**
   * Unix timestamp for when the bid is no longer valid in seconds
   */
  valid_until: bigint;
};

/**
 * All the parameters necessary to represent a liquidation opportunity
 */
export type OpportunityParams = {
  /**
   * The chain id where the liquidation will be executed.
   */
  chain_id: string;

  /**
   * Unique identifier for the opportunity
   */
  opportunity_id: string;
  /**
   * Permission key required for succesful execution of the liquidation.
   */
  permission_key: Hex;
  /**
   * Contract address to call for execution of the liquidation.
   */
  contract: Address;
  /**
   * Calldata for the contract call.
   */
  calldata: Hex;
  /**
   * Value to send with the contract call.
   */
  value: bigint;

  /**
   * Tokens required to repay the debt
   */
  repay_tokens: TokenQty[];
  /**
   * Tokens to receive after the liquidation
   */
  receipt_tokens: TokenQty[];
};

/**
 * Represents a bid for a liquidation opportunity
 */
export type OpportunityBid = {
  /**
   * Opportunity unique identifier in uuid format
   */
  opportunity_id: string;
  /**
   * The permission key required for succesful execution of the liquidation.
   */
  permission_key: Hex;
  /**
   * Liquidator address
   */
  liquidator: Address;
  /**
   * Signature of the liquidator
   */
  signature: Hex;

  bid: BidInfo;
};

export function checkHex(hex: string): Hex {
  if (isHex(hex)) {
    return hex;
  }
  throw new Error(`Invalid hex: ${hex}`);
}

export function checkAddress(address: string): Address {
  if (isAddress(address)) {
    return address;
  }
  throw new Error(`Invalid address: ${address}`);
}

function checkTokenQty(token: { contract: string; amount: string }): TokenQty {
  return {
    contract: checkAddress(token.contract),
    amount: BigInt(token.amount),
  };
}

export class Client {
  private clientOptions?: ClientOptions;

  constructor(clientOptions?: ClientOptions) {
    this.clientOptions = clientOptions;
  }

  /**
   * Fetches liquidation opportunities
   * @param chain_id Chain id to fetch opportunities for. e.g: sepolia
   */
  async getOpportunities(chain_id?: string): Promise<OpportunityParams[]> {
    const client = createClient<paths>(this.clientOptions);
    const opportunities = await client.GET("/v1/liquidation/opportunities", {
      params: { query: { chain_id } },
    });
    if (opportunities.data === undefined) {
      throw new Error("No opportunities found");
    }
    return opportunities.data.flatMap((opportunity) => {
      if (opportunity.version != "v1") {
        console.warn(
          `Can not handle opportunity version: ${opportunity.version}. Please upgrade your client.`
        );
        return [];
      }
      return {
        chain_id: opportunity.chain_id,
        opportunity_id: opportunity.opportunity_id,
        permission_key: checkHex(opportunity.permission_key),
        contract: checkAddress(opportunity.contract),
        calldata: checkHex(opportunity.calldata),
        value: BigInt(opportunity.value),
        repay_tokens: opportunity.repay_tokens.map(checkTokenQty),
        receipt_tokens: opportunity.receipt_tokens.map(checkTokenQty),
      };
    });
  }

  /**
   * Submits a liquidation opportunity to be exposed to searchers
   * @param opportunity Opportunity to submit
   */
  async submitOpportunity(
    opportunity: Omit<OpportunityParams, "opportunity_id">
  ) {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST("/v1/liquidation/opportunities", {
      body: {
        chain_id: opportunity.chain_id,
        version: "v1",
        permission_key: opportunity.permission_key,
        contract: opportunity.contract,
        calldata: opportunity.calldata,
        value: opportunity.value.toString(),
        repay_tokens: opportunity.repay_tokens.map((token) => ({
          contract: token.contract,
          amount: token.amount.toString(),
        })),
        receipt_tokens: opportunity.receipt_tokens.map((token) => ({
          contract: token.contract,
          amount: token.amount.toString(),
        })),
      },
    });
    if (response.error) {
      throw new Error(response.error.error);
    }
  }

  /**
   * Creates a signed bid for a liquidation opportunity
   * @param opportunity Opportunity to bid on
   * @param bid_info Bid amount and valid until timestamp
   * @param privateKey Private key to sign the bid with
   */
  async signOpporunityBid(
    opportunity: OpportunityParams,
    bid_info: BidInfo,
    privateKey: Hex
  ): Promise<OpportunityBid> {
    const account = privateKeyToAccount(privateKey);
    const convertTokenQty = (token: TokenQty): [Hex, bigint] => [
      token.contract,
      token.amount,
    ];
    const payload = encodeAbiParameters(
      [
        {
          name: "repay_tokens",
          type: "tuple[]",
          components: [
            {
              type: "address",
            },
            {
              type: "uint256",
            },
          ],
        },
        {
          name: "receipt_tokens",
          type: "tuple[]",
          components: [
            {
              type: "address",
            },
            {
              type: "uint256",
            },
          ],
        },
        { name: "contract", type: "address" },
        { name: "calldata", type: "bytes" },
        { name: "value", type: "uint256" },
        { name: "bid", type: "uint256" },
      ],
      [
        opportunity.repay_tokens.map(convertTokenQty),
        opportunity.receipt_tokens.map(convertTokenQty),
        opportunity.contract,
        opportunity.calldata,
        opportunity.value,
        bid_info.amount,
      ]
    );

    const raw_msg = keccak256(
      encodePacked(["bytes", "uint256"], [payload, bid_info.valid_until])
    );

    const hash = signatureToHex(await sign({ hash: raw_msg, privateKey }));
    return {
      permission_key: opportunity.permission_key,
      bid: bid_info,
      liquidator: account.address,
      signature: hash,
      opportunity_id: opportunity.opportunity_id,
    };
  }

  /**
   * Submits a bid for a liquidation opportunity
   * @param bid
   */
  async submitOpportunityBid(bid: OpportunityBid) {
    const client = createClient<paths>(this.clientOptions);
    const response = await client.POST(
      "/v1/liquidation/opportunities/{opportunity_id}/bids",
      {
        body: {
          amount: bid.bid.amount.toString(),
          liquidator: bid.liquidator,
          permission_key: bid.permission_key,
          signature: bid.signature,
          valid_until: bid.bid.valid_until.toString(),
        },
        params: { path: { opportunity_id: bid.opportunity_id } },
      }
    );
    if (response.error) {
      throw new Error(response.error.error);
    }
  }
}
