import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { QueryClient } from "@cosmjs/stargate";
import { WasmExtension, setupWasmExtension } from "@cosmjs/cosmwasm-stargate";

export type ContractInfoRequest = {
  contractAddr: string;
};

export type ContractInfoResponse = {
  codeId: number;
  creator: string;
  admin: string;
  label: string;
};

export type SmartContractRequest = {
  contractAddr: string;
  query: Object;
};

export type RawContractStateRequest = {
  contractAddr: string;
  key: Buffer;
};

export type AllContractStateRequest = {
  contractAddr: string;
};

export interface ChainQuerier {
  getContractInfo(req: ContractInfoRequest): Promise<ContractInfoResponse>;
  getSmartContractState(req: SmartContractRequest): Promise<Object>;
  getRawContractState(req: RawContractStateRequest): Promise<Object>;
  getAllContractState(req: AllContractStateRequest): Promise<Object>;
}

export class GenericQuerier implements ChainQuerier {
  private readonly wasmQueryClient: WasmExtension;
  private constructor(readonly tendermintClient: Tendermint34Client) {
    this.wasmQueryClient = setupWasmExtension(
      new QueryClient(tendermintClient)
    );
  }

  async getContractInfo(
    req: ContractInfoRequest
  ): Promise<ContractInfoResponse> {
    const { contractAddr } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    const { contractInfo } = await wasmQueryClient.getContractInfo(
      contractAddr
    );

    if (contractInfo === undefined)
      throw new Error("error fetching contract info");

    return { ...contractInfo, codeId: contractInfo.codeId.toNumber() };
  }

  async getSmartContractState(req: SmartContractRequest): Promise<Object> {
    const { contractAddr, query } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    return await wasmQueryClient.queryContractSmart(contractAddr, query);
  }

  async getRawContractState(req: RawContractStateRequest): Promise<Object> {
    const { contractAddr, key } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    const { data } = await wasmQueryClient.queryContractRaw(contractAddr, key);
    return JSON.parse(Buffer.from(data).toString());
  }

  async getAllContractState(req: AllContractStateRequest): Promise<Object> {
    const { contractAddr } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    const { models } = await wasmQueryClient.getAllContractState(contractAddr);

    const state = models.reduce((prevValue, model) => {
      const key = Buffer.from(model.key).toString();
      const value = Buffer.from(model.value).toString();

      prevValue[key] = value;

      return prevValue;
    }, {} as any);

    return state;
  }

  static async connect(endpoint: string): Promise<GenericQuerier> {
    const tendermintClient = await Tendermint34Client.connect(endpoint);
    return new GenericQuerier(tendermintClient);
  }
}
