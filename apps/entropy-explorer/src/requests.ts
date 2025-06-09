import { z } from "zod";

import { EntropyDeployments, isValidDeployment } from "./entropy-deployments";
import type { PAGE_SIZE } from "./pages";
import { DEFAULT_PAGE_SIZE } from "./pages";

export type Args = Partial<{
  search: string;
  chain: number;
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
  const url = new URL("/v1/logs", "http://localhost:34000");
  url.searchParams.set("min_timestamp", new Date("2023-10-01").toISOString());
  url.searchParams.set("max_timestamp", new Date("2033-10-01").toISOString());
  url.searchParams.set("limit", pageSize.toString());
  if (page) {
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());
  }
  if (search) {
    url.searchParams.set("query", search);
  }
  if (chain) {
    url.searchParams.set("network_id", chain.toString());
  }
  const fortunaStatus = status ? toFortunaStatus(status) : undefined;
  if (fortunaStatus) {
    url.searchParams.set("state", fortunaStatus);
  }
  const response = await fetch(url);
  if (response.status === 400) {
    return search === undefined
      ? Result.ErrorResult()
      : Result.BadSearch(search);
  } else if (response.status === 200) {
    try {
      const parsed = fortunaSchema.parse(await response.json());
      return Result.Success({
        numPages: Math.ceil(parsed.total_results / pageSize),
        currentPage: parsed.requests.map((request) => {
          const common = {
            chain: request.network_id,
            gasLimit: request.gas_limit,
            provider: request.provider,
            providerContribution: "TEST", // TODO request.state.provider_random_number,
            requestTimestamp: request.created_at,
            requestTxHash: request.request_tx_hash,
            sender: request.sender,
            sequenceNumber: request.sequence,
            userContribution: request.user_random_number,
          };
          switch (request.state.state) {
            case "completed": {
              return Request.Complete({
                ...common,
                callbackTxHash: request.state.reveal_tx_hash,
                callbackTimestamp: request.last_updated_at,
                gasUsed: request.state.gas_used,
                randomNumber: request.state.combined_random_number,
              });
            }
            case "pending": {
              return Request.Pending(common);
            }
            case "failed": {
              return Request.CallbackErrored({
                ...common,
                returnValue: request.state.reason,
                callbackTimestamp: request.last_updated_at,
                gasUsed: 0, // TODO
                randomNumber: "foobar", // TODO
              });
            }
          }
        }),
      });
    } catch {
      return Result.ErrorResult();
    }
  } else {
    return Result.ErrorResult();
  }
};

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
  ErrorResult: () => ({ type: ResultType.ErrorResult as const }),
};
type Result = ReturnType<(typeof Result)[keyof typeof Result]>;
export type Success = ReturnType<typeof Result.Success>;
export type BadSearch = ReturnType<typeof Result.BadSearch>;
export type ErrorResult = ReturnType<typeof Result.ErrorResult>;

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
      gas_limit: z.string().transform((value) => Number.parseInt(value, 10)),
      last_updated_at: z.string().transform((value) => new Date(value)),
      network_id: z.number().refine(
        (value) => isValidDeployment(value),
        (value) => ({ message: `Unrecognized chain id: ${value.toString()}` }),
      ),
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
  CallbackError,
  Complete,
}

type BaseArgs = {
  chain: keyof typeof EntropyDeployments;
  sequenceNumber: number;
  provider: `0x${string}`;
  sender: `0x${string}`;
  requestTxHash: `0x${string}`;
  gasLimit: number;
  requestTimestamp: Date;
  userContribution: string;
  providerContribution: string;
};
type PendingArgs = BaseArgs;
type RevealedBaseArgs = BaseArgs & {
  randomNumber: string;
  gasUsed: number;
  callbackTimestamp: Date;
};
type CallbackErrorArgs = RevealedBaseArgs & {
  returnValue: string;
};
type CompleteArgs = RevealedBaseArgs & {
  callbackTxHash: `0x${string}`;
};

const Request = {
  Pending: (args: PendingArgs) => ({
    status: Status.Pending as const,
    ...args,
  }),
  CallbackErrored: (args: CallbackErrorArgs) => ({
    status: Status.CallbackError as const,
    ...args,
  }),
  Complete: (args: CompleteArgs) => ({
    status: Status.Complete as const,
    ...args,
  }),
};
export type Request = ReturnType<(typeof Request)[keyof typeof Request]>;
export type PendingRequest = ReturnType<typeof Request.Pending>;
export type CallbackErrorRequest = ReturnType<typeof Request.CallbackErrored>;
export type CompleteRequest = ReturnType<typeof Request.Complete>;

export const StatusParams = {
  [Status.Pending]: "pending",
  [Status.Complete]: "complete",
  [Status.CallbackError]: "callback-error",
} as const;

const toFortunaStatus = (status: string) => {
  switch (status) {
    case StatusParams[Status.Pending]: {
      return "Pending";
    }
    case StatusParams[Status.CallbackError]: {
      return "Failed";
    }
    case StatusParams[Status.Complete]: {
      return "Completed";
    }
    default: {
      return;
    }
  }
};
