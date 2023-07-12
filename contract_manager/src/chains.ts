import { readdirSync, readFileSync, writeFileSync } from "fs";
import { Storable } from "./base";

export abstract class Chain extends Storable {
  protected constructor(public id: string) {
    super();
  }

  getId(): string {
    return this.id;
  }
}

export class CosmWasmChain extends Chain {
  static type: string = "CosmWasmChain";

  constructor(
    id: string,
    public querierEndpoint: string,
    public executorEndpoint: string,
    public gasPrice: string,
    public prefix: string,
    public feeDenom: string
  ) {
    super(id);
  }

  static fromJson(parsed: any): CosmWasmChain {
    if (parsed.type !== CosmWasmChain.type) throw new Error("Invalid type");
    return new CosmWasmChain(
      parsed.id,
      parsed.querierEndpoint,
      parsed.executorEndpoint,
      parsed.gasPrice,
      parsed.prefix,
      parsed.feeDenom
    );
  }

  toJson(): any {
    return {
      querierEndpoint: this.querierEndpoint,
      executorEndpoint: this.executorEndpoint,
      id: this.id,
      gasPrice: this.gasPrice,
      prefix: this.prefix,
      feeDenom: this.feeDenom,
      type: CosmWasmChain.type,
    };
  }

  getType(): string {
    return CosmWasmChain.type;
  }
}

export class SuiChain extends Chain {
  static type: string = "SuiChain";

  constructor(id: string, public rpcUrl: string) {
    super(id);
  }

  static fromJson(parsed: any): SuiChain {
    if (parsed.type !== SuiChain.type) throw new Error("Invalid type");
    return new SuiChain(parsed.id, parsed.rpcUrl);
  }

  toJson(): any {
    return {
      id: this.id,
      rpcUrl: this.rpcUrl,
      type: SuiChain.type,
    };
  }

  getType(): string {
    return SuiChain.type;
  }
}

export class EVMChain extends Chain {
  static type: string = "EVMChain";

  constructor(id: string, public rpcUrl: string) {
    super(id);
  }

  static fromJson(parsed: any): SuiChain {
    if (parsed.type !== EVMChain.type) throw new Error("Invalid type");
    return new EVMChain(parsed.id, parsed.rpcUrl);
  }

  toJson(): any {
    return {
      id: this.id,
      rpcUrl: this.rpcUrl,
      type: EVMChain.type,
    };
  }

  getType(): string {
    return EVMChain.type;
  }
}

export const Chains: Record<string, Chain> = {};
