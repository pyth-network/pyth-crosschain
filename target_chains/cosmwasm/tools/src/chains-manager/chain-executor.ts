import { Coin } from "@cosmjs/stargate";
// TODO: expose these executors and consume them in price pusher
/**
 * Interface for classes that implements contract management for a chain.
 *
 * This interface has the methods to interact with the contract in a way that will change its state.
 * Hence any interaction with the contract will requires a transaction to be broadcasted.
 * Each class implementation will need a mnemonic key using which it will be able to sign and
 * broadcast transactions.
 *
 * Interactions can be one of the following:
 * - storing a code on chain
 * - instantiating a new contract
 * - executing a contract
 * - migrating a contract
 * - updating the contract's admin
 *
 * @interface ChainExecutor
 */
export interface ChainExecutor {
  /**
   * `storeCode` stores a cosmwasm contract code on chain.
   * @param {StoreCodeRequest} req
   * @param {Buffer} req.contractBytes - The contractBytes of the contract you want to store.
   * @returns {StoreCodeResponse}
   * - {number} res.codeId. The codeId of the stored code.
   * - {string} res.txHash. The broadcasted transaction hash.
   *
   * @throws an error if it fails.
   */
  storeCode(req: StoreCodeRequest): Promise<StoreCodeResponse>;

  /**
   * `instantiateContract` instantiates a new contract for the given code id and instMsg.
   * @param {InstantiateContractRequest} req
   * @param {number} req.codeId - The code id of the deployed code.
   * @param {object} req.instMsg - The instantiating msg as per the contract requirements.
   * @param {string} req.label - The label for the new contract.
   *
   * @returns {InstantiateContractResponse}
   * - {string} res.contractAddr. The address of the new contract.
   * - {string} res.txHash. The broadcasted transaction hash.
   *
   * @throws an error if it fails
   */
  instantiateContract(
    req: InstantiateContractRequest,
  ): Promise<InstantiateContractResponse>;

  /**
   * `executeContract` execute the contract identified via given contract address.
   * @param {ExecuteContractRequest} req
   * @param {string} req.contractAddr
   * @param {object} req.msg - The msg to be executed on the given contract. The message is contract dependent and hence its structure is not defined.
   * @param {Fund[]} [req.funds] - Funds one want to send to the given contract when executing.
   *
   * @returns {ExecuteContractResponse} - {string} res.txHash. The broadcasted transaction hash.
   *
   * @throws an error if it fails
   */
  executeContract(
    req: ExecuteContractRequest,
  ): Promise<ExecuteContractResponse>;

  /**
   * `migrateContract` migrates the given contract addr to the given new code id.
   * It assumes that the key used to sign the transaction is the current admin of the given contract.
   * If that is not the case this method will raise error.
   *
   * @param {MigrateContractRequest} req
   * @param {string} req.contractAddr
   * @param {number} req.newCodeId
   * @param {object | undefined} [req.migrateMsg] - It depends upon the contract and hence the structure is not defined. It accepts any msg given to it.
   *
   * @returns {MigrateContractResponse} - {string} res.txHash. The broadcasted transaction hash.
   *
   * @throws an error if it fails.
   */
  migrateContract(
    req: MigrateContractRequest,
  ): Promise<MigrateContractResponse>;

  /**
   * `updateContractAdmin` updates the admin of the given contract addr to the given new Admin address.
   * It assumes that the key used to sign the transaction is the current admin of the given contract.
   * If that is not the case, this method will raise error.
   *
   * @param {UpdateContractAdminRequest} req
   * @param {string} req.contractAddr
   * @param {string} req.newAdminAddr
   *
   * @returns {UpdateContractAdminResponse} - {string} res.txHash. The broadcasted transaction hash.
   *
   * @throws an error if it fails
   */
  updateContractAdmin(
    req: UpdateContractAdminRequest,
  ): Promise<UpdateContractAdminResponse>;
}

export type StoreCodeRequest = {
  contractBytes: Buffer;
};
export type StoreCodeResponse = {
  codeId: number;
  txHash: string;
};

export type InstantiateContractRequest = {
  codeId: number;
  instMsg: object;
  label: string;
};
export type InstantiateContractResponse = {
  contractAddr: string;
  txHash: string;
};

export type ExecuteContractRequest = {
  contractAddr: string;
  msg: object;
  funds?: Coin[];
};
export type ExecuteContractResponse = {
  txHash: string;
};

export type MigrateContractRequest = {
  contractAddr: string;
  newCodeId: number;
  migrateMsg?: object;
};
export type MigrateContractResponse = {
  txHash: string;
};

export type UpdateContractAdminRequest = {
  newAdminAddr: string;
  contractAddr: string;
};
export type UpdateContractAdminResponse = {
  txHash: string;
};
