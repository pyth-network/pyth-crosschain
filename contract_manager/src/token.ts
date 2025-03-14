import axios from "axios";
import { KeyValueConfig, Storable } from "./base";

export type TokenId = string;
/**
 * A quantity of a token, represented as an integer number of the minimum denomination of the token.
 * This can also represent a quantity of an unknown token (represented by an undefined denom).
 */
export type TokenQty = {
  amount: bigint;
  denom: TokenId | undefined;
};

/**
 * A token represents a cryptocurrency like ETH or BTC.
 * The main use of this class is to calculate the dollar value of accrued fees.
 */
export class Token extends Storable {
  static type = "token";

  public constructor(
    public id: TokenId,
    // The hexadecimal pyth id of the tokens X/USD price feed
    // (get this from hermes or the Pyth docs page)
    public pythId: string | undefined,
    public decimals: number,
  ) {
    super();
  }

  getId(): TokenId {
    return this.id;
  }

  getType(): string {
    return Token.type;
  }

  /**
   * Get the dollar value of 1 token. Returns undefined for tokens that do
   * not have a configured pricing method.
   */
  async getPrice(): Promise<number | undefined> {
    if (this.pythId) {
      const url = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${this.pythId}&parsed=true`;
      const response = await axios.get(url);
      const price = response.data.parsed[0].price;

      // Note that this conversion can lose some precision.
      // We don't really care about that in this application.
      return parseInt(price.price) * Math.pow(10, price.expo);
    } else {
      // We may support other pricing methodologies in the future but whatever.
      return undefined;
    }
  }

  /**
   * Get the dollar value of the minimum representable quantity of this token.
   * E.g., for ETH, this method will return the dollar value of 1 wei.
   */
  async getPriceForMinUnit(): Promise<number | undefined> {
    const price = await this.getPrice();
    return price ? price / Math.pow(10, this.decimals) : undefined;
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      ...(this.pythId !== undefined ? { pythId: this.pythId } : {}),
    };
  }

  static fromJson(parsed: {
    id: string;
    pythId?: string;
    decimals: number;
  }): Token {
    return new Token(parsed.id, parsed.pythId, parsed.decimals);
  }
}
