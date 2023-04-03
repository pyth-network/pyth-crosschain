import { CosmwasmExecutor } from "./cosmwasm";
import { InjectiveExecutor } from "./injective";

export type Fund = {
  denom: string;
  amount: string;
};
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
  funds?: Fund[];
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
  newAdmin: string;
  contractAddr: string;
};
export type UpdateContractAdminResponse = {
  txHash: string;
};

// if a transaction fails, methods will raise an error
export interface ChainExecutor {
  storeCode(req: StoreCodeRequest): Promise<StoreCodeResponse>;
  instantiateContract(
    req: InstantiateContractRequest
  ): Promise<InstantiateContractResponse>;
  executeContract(
    req: ExecuteContractRequest
  ): Promise<ExecuteContractResponse>;
  // this method assumes that the key used to execute this method is
  // the admin of the given contract or else it will throw an error
  migrateContract(
    req: MigrateContractRequest
  ): Promise<MigrateContractResponse>;
  // this method assumes that the key used to execute this method is
  // the current admin of the given contract or else it will throw an error
  updateContractAdmin(
    req: UpdateContractAdminRequest
  ): Promise<UpdateContractAdminResponse>;
}

export enum ChainExecutorType {
  INJECTIVE = "injective",
  COSMWASM = "cosmwasm",
}

export type ChainExecutorFactoryArgs =
  | {
      type: ChainExecutorType.INJECTIVE;
      value: InjectiveConfig;
    }
  | {
      type: ChainExecutorType.COSMWASM;
      value: CosmwasmConfig;
    };

export type InjectiveConfig = {
  grpcEndpoint: string;
  mnemonic: string;
};

export type CosmwasmConfig = {
  endpoint: string;
  mnemonic: string;
  prefix: string;
  gasPrice: string;
  // FIXME: probably have to pass the hd path too. not sure
};

export function ChainExecutorFactory({
  type,
  value,
}: ChainExecutorFactoryArgs): ChainExecutor {
  if (type === ChainExecutorType.INJECTIVE) {
    return new InjectiveExecutor(value.grpcEndpoint, value.mnemonic);
  }

  return new CosmwasmExecutor(
    value.endpoint,
    value.mnemonic,
    value.prefix,
    value.gasPrice
  );
}
