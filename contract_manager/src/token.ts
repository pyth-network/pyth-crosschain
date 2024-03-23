import { KeyValueConfig, Storable } from "./base";

export class Token extends Storable {
  static type = "Token";

  public constructor(
    public id: string,
    public pythId: string | undefined,
  ) {
    super();
  }

  getId(): string {
    return this.id;
  }

  getType(): string {
    return Token.type;
  }

  getPrice(): Promise<bigint> {
    if (this.pythId) {
      axios.get()
    }
  }

  toJson(): KeyValueConfig {
    return {
      id: this.id,
      ...(this.pythId !== undefined ? {pythId: this.pythId} : {}),
    };
  }

  static fromJson(parsed: {id: string, pythId?: string}): Token {
    return new Token(
      parsed.id,
      parsed.pythId,
    );
  }
}