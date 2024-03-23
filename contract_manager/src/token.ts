import axios from 'axios';
import { KeyValueConfig, Storable } from "./base";

export class Token extends Storable {
  static type = "token";

  public constructor(
    public id: string,
    public pythId: string | undefined,
    public decimals: number,
  ) {
    super();
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return Token.type;
  }

  async getPrice(): Promise<number> {
    if (this.pythId) {
      const url = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${this.pythId}&parsed=true`;
      const response = await axios.get(url)
      const price = response.data.parsed[0].price;

      // Note that this conversion can lose some precision.
      // We don't really care about that in this application.
      return parseInt(price.price) * Math.pow(10, price.expo) / Math.pow(10, this.decimals);
    } else {
      // If the token doesn't have a pyth id, assume it's a shitcoin
      // and worth 0.
      return 0;
    }
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      ...(this.pythId !== undefined ? {pythId: this.pythId} : {}),
    };
  }

  static fromJson(parsed: {id: string, pythId?: string, decimals: number}): Token {
    return new Token(
      parsed.id,
      parsed.pythId,
      parsed.decimals,
    );
  }
}