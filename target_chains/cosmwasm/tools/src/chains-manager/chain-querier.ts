import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { QueryClient } from "@cosmjs/stargate";
import { WasmExtension, setupWasmExtension } from "@cosmjs/cosmwasm-stargate";

// TODO: expose the querier and consume them in price pusher

/**
 * Interface for classes implementing a querier for a cosmwasm chain.
 *
 * The querier interacts with contracts only and can get it's info, stored state.
 * It can also query the `Query methods` defined in the contract.
 *
 * For contract dependent response, you need to look into contract specific schema in order
 * to know what to expect
 *
 * @interface ChainQuerier
 */
export interface ChainQuerier {
  /**
   * `getContractInfo` gets the contract info for the give contract address.
   * @param {ContractInfoRequest} req
   * @param {string} req.contractAddr
   * @returns {ContractInfoResponse}
   * - {number} res.codeId. The codeId of the contract's code.
   * - {string} res.creator. The creator of the contract.
   * - {string} res.adminAddr - Address of the current admin.
   * - {string} res.label - The label with which the contract was instantiated
   *
   * @throws an error if it fails.
   */
  getContractInfo(req: ContractInfoRequest): Promise<ContractInfoResponse>;

  /**
   * `getSmartContractState` query the `Query methods` implemented in the contract
   * @param {SmartContractRequest} req
   * @param {string} req.contractAddr
   * @param {Object} req.query - The query object for the contract. It accepts any object as it is contract dependent.
   * @returns {Object} - It returns an object. As the response is contract dependent we can't have a structure for it.
   *
   * @throws an error if it fails.
   */
  getSmartContractState(req: SmartContractRequest): Promise<Object>;

  /**
   * Contracts local storage on chain is structured as key-value pairs.
   * `getSmartContractState` query the local storage of a contract for the given key.
   * @param {RawContractStateRequest} req
   * @param {string} req.contractAddr
   * @param {Buffer} req.key
   * @returns {Object} - It returns an object. As the response is contract dependent we can't have a structure for it.
   *
   * @throws an error if it fails.
   */
  getRawContractState(req: RawContractStateRequest): Promise<Object>;

  /**
   * Contracts local storage on chain is structured as key-value pairs.
   * `getAllContractState` query the local storage of a contract for all such pairs.
   * @param {AllContractStateRequest} req
   * @param {string} req.contractAddr
   * @returns {Object} - It returns an object. As the response is contract dependent we can't have a structure for it.
   *
   * @throws an error if it fails.
   */
  getAllContractState(req: AllContractStateRequest): Promise<Object>;
}

export type ContractInfoRequest = {
  contractAddr: string;
};

export type ContractInfoResponse = {
  codeId: number;
  creator: string;
  adminAddr: string;
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

export type GetCodeRequest = {
  codeId: number;
};

export type AllContractStateRequest = {
  contractAddr: string;
};

export class CosmwasmQuerier implements ChainQuerier {
  private readonly wasmQueryClient: WasmExtension;

  private constructor(readonly tendermintClient: Tendermint34Client) {
    this.wasmQueryClient = setupWasmExtension(
      new QueryClient(tendermintClient),
    );
  }

  async getContractInfo(
    req: ContractInfoRequest,
  ): Promise<ContractInfoResponse> {
    const { contractAddr } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    const { contractInfo } =
      await wasmQueryClient.getContractInfo(contractAddr);

    if (contractInfo === undefined)
      throw new Error("error fetching contract info");

    return {
      ...contractInfo,
      codeId: Number(contractInfo.codeId),
      adminAddr: contractInfo.admin,
    };
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

  async getCode(req: GetCodeRequest): Promise<Buffer> {
    const { codeId } = req;

    const { wasm: wasmQueryClient } = this.wasmQueryClient;

    const { data } = await wasmQueryClient.getCode(codeId);
    return Buffer.from(data);
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

  static async connect(endpoint: string): Promise<CosmwasmQuerier> {
    const tendermintClient = await Tendermint34Client.connect(endpoint);
    return new CosmwasmQuerier(tendermintClient);
  }
}
