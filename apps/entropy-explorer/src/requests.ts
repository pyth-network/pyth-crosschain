import { z } from "zod";

import type { ChainSlug, EntropyDeployment } from "./entropy-deployments";
import {
  getChainNetworkId,
  parseChainSlug,
  EntropyDeployments,
} from "./entropy-deployments";
import type { PAGE_SIZE } from "./pages";
import { DEFAULT_PAGE_SIZE } from "./pages";

const FORTUNA_MAINNET_URL = "https://fortuna.dourolabs.app/";
const FORTUNA_TESTNET_URL = "https://fortuna-staging.dourolabs.app/";

export type Args = Partial<{
  search: string;
  chain: string;
  status: string;
  pageSize: PAGE_SIZE;
  page: number;
}>;

export const getRequests = async ({
  search,
  chain,
  status,
  pageSize = DEFAULT_PAGE_SIZE,
  page,
}: Args): Promise<Result> => {
  const chainSlug = parseChainSlug(chain);
  const networkId = getChainNetworkId(chainSlug);
  const url = new URL("/v1/logs", getFortunaUrl(chainSlug));
  url.searchParams.set("min_timestamp", new Date("2023-10-01").toISOString());
  url.searchParams.set("max_timestamp", new Date("2033-10-01").toISOString());
  url.searchParams.set("limit", pageSize.toString());
  if (page) {
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());
  }
  if (search) {
    url.searchParams.set("query", search);
  }
  if (networkId) {
    url.searchParams.set("network_id", networkId.toString());
  }
  const fortunaStatus = status ? toFortunaStatus(status) : undefined;
  if (fortunaStatus) {
    url.searchParams.set("state", fortunaStatus);
  }
  try {
    const response = await fetch(url);
    if (response.status === 400) {
      const text = await response.text();
      return text ===
        "The query string is not parsable to a transaction hash, address, or sequence number" &&
        search !== undefined
        ? Result.BadSearch(search)
        : Result.ErrorResult(toError(text));
    } else if (response.status === 200) {
      try {
        const parsed = fortunaSchema.safeParse(await response.json());
        return parsed.success
          ? Result.Success({
              numPages: Math.ceil(parsed.data.total_results / pageSize),
              currentPage: parsed.data.requests.map((request) => {
                const common = {
                  chain: getChain(request.network_id),
                  gasLimit: request.gas_limit,
                  provider: request.provider,
                  requestTimestamp: request.created_at,
                  requestTxHash: request.request_tx_hash,
                  sender: request.sender,
                  sequenceNumber: request.sequence,
                  userContribution: request.user_random_number,
                };
                switch (request.state.state) {
                  case "completed": {
                    const completedCommon = {
                      ...common,
                      callbackTxHash: request.state.reveal_tx_hash,
                      callbackTimestamp: request.last_updated_at,
                      gasUsed: request.state.gas_used,
                      randomNumber: request.state.combined_random_number,
                      providerContribution:
                        request.state.provider_random_number,
                    };
                    return request.state.callback_failed
                      ? Request.CallbackErrored({
                          ...completedCommon,
                          reason: request.state.callback_return_value,
                        })
                      : Request.Complete({
                          ...completedCommon,
                        });
                  }
                  case "pending": {
                    return Request.Pending(common);
                  }
                  case "failed": {
                    return Request.Failed({
                      ...common,
                      reason: request.state.reason.replace(/^Reverted: /, ""),
                      providerContribution:
                        request.state.provider_random_number,
                    });
                  }
                }
              }),
            })
          : Result.ErrorResult(parsed.error);
      } catch (error) {
        return Result.ErrorResult(toError(error));
      }
    } else {
      return Result.ErrorResult(new NotOKError(response));
    }
  } catch (error) {
    return Result.ErrorResult(toError(error));
  }
};

class NotOKError extends Error {
  constructor(result: Response) {
    super(`Received a ${result.status.toString()} response for ${result.url}`);
    this.cause = result;
    this.name = "NotOKError";
  }
}

const toError = (e: unknown) => {
  if (e instanceof Error) {
    return e;
  } else if (typeof e === "string") {
    return new UnknownError(e);
  } else {
    return new UnknownError("Unknown Error");
  }
};

class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export enum ResultType {
  Success,
  BadSearch,
  ErrorResult,
}

const Result = {
  Success: ({
    numPages,
    currentPage,
  }: {
    numPages: number;
    currentPage: Request[];
  }) => ({ type: ResultType.Success as const, numPages, currentPage }),
  BadSearch: (search: string) => ({
    type: ResultType.BadSearch as const,
    search,
  }),
  ErrorResult: (error: Error) => ({
    type: ResultType.ErrorResult as const,
    error,
  }),
};
type Result = ReturnType<(typeof Result)[keyof typeof Result]>;

const hexStringSchema = z.custom<`0x${string}`>(
  (val) => typeof val === "string" && val.startsWith("0x"),
);

const completedStateSchema = z.strictObject({
  combined_random_number: z.string(),
  gas_used: z.string().transform((value) => Number.parseInt(value, 10)),
  provider_random_number: z.string(),
  reveal_block_number: z.number(),
  reveal_tx_hash: hexStringSchema,
  state: z.literal("completed"),
  callback_failed: z.boolean(),
  callback_return_value: z.string(),
  callback_gas_used: z.string(),
});

const pendingStateSchema = z.strictObject({
  state: z.literal("pending"),
});

const failedSchema = z.strictObject({
  provider_random_number: z.string(),
  reason: z.string(),
  state: z.literal("failed"),
});

const fortunaSchema = z.strictObject({
  total_results: z.number(),
  requests: z.array(
    z.strictObject({
      chain_id: z.string(),
      created_at: z.string().transform((value) => new Date(value)),
      gas_limit: z.number(),
      last_updated_at: z.string().transform((value) => new Date(value)),
      network_id: z.number(),
      provider: hexStringSchema,
      request_block_number: z.number(),
      request_tx_hash: hexStringSchema,
      sender: hexStringSchema,
      sequence: z.number(),
      user_random_number: z.string(),
      state: z.union([completedStateSchema, pendingStateSchema, failedSchema]),
    }),
  ),
});

export enum Status {
  Pending,
  Failed,
  CallbackError,
  Complete,
}

type BaseArgs = {
  chain: EntropyDeployment;
  sequenceNumber: number;
  provider: `0x${string}`;
  sender: `0x${string}`;
  requestTxHash: `0x${string}`;
  gasLimit: number;
  requestTimestamp: Date;
  userContribution: string;
};
type PendingArgs = BaseArgs;
type FailedArgs = BaseArgs & {
  reason: string;
  providerContribution: string;
};
type CompletedArgs = BaseArgs & {
  randomNumber: string;
  gasUsed: number;
  callbackTimestamp: Date;
  providerContribution: string;
  callbackTxHash: `0x${string}`;
};
type CallbackErrorArgs = CompletedArgs & {
  reason: string;
};

const Request = {
  Pending: (args: PendingArgs) => ({
    status: Status.Pending as const,
    ...args,
  }),
  Failed: (args: FailedArgs) => ({
    status: Status.Failed as const,
    ...args,
  }),
  CallbackErrored: (args: CallbackErrorArgs) => ({
    status: Status.CallbackError as const,
    ...args,
  }),
  Complete: (args: CompletedArgs) => ({
    status: Status.Complete as const,
    ...args,
  }),
};
export type Request = ReturnType<(typeof Request)[keyof typeof Request]>;
export type PendingRequest = ReturnType<typeof Request.Pending>;
export type FailedRequest = ReturnType<typeof Request.Failed>;
export type CallbackErrorRequest = ReturnType<typeof Request.CallbackErrored>;
export type CompleteRequest = ReturnType<typeof Request.Complete>;

export const StatusParams = {
  [Status.Pending]: "pending",
  [Status.Failed]: "failed",
  [Status.Complete]: "complete",
  [Status.CallbackError]: "callback-error",
} as const;

const toFortunaStatus = (status: string) => {
  switch (status) {
    case StatusParams[Status.Pending]: {
      return "Pending";
    }
    case StatusParams[Status.Failed]: {
      return "Failed";
    }
    case StatusParams[Status.Complete]: {
      return "Completed";
    }
    case StatusParams[Status.CallbackError]: {
      return "CallbackErrored";
    }
    default: {
      return;
    }
  }
};

const getChain = (networkId: number) => {
  const chain = Object.values(EntropyDeployments).find(
    (deployment) => deployment.chainId === networkId,
  );
  if (chain) {
    return chain;
  } else {
    throw new Error(`Invalid chain id: ${networkId.toString()}`);
  }
};

const getFortunaUrl = (chainSlug: ChainSlug) => {
  switch (chainSlug) {
    case "all-mainnet": {
      return FORTUNA_MAINNET_URL;
    }
    case "all-testnet": {
      return FORTUNA_TESTNET_URL;
    }
    default: {
      return EntropyDeployments[chainSlug].isTestnet
        ? FORTUNA_TESTNET_URL
        : FORTUNA_MAINNET_URL;
    }
  }
};
