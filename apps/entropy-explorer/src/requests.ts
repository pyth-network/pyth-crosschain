import { z } from "zod";

import type { EntropyDeployments } from "./entropy-deployments";
import { ERROR_DETAILS } from "./errors";

const MOCK_DATA_SIZE = 20;

export const getRequests = async (): Promise<Request[]> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return requestsSchema.parse(
    range(MOCK_DATA_SIZE).map(() => {
      const completed = randomBoolean();
      const gasLimit = randomBetween(10_000, 1_000_000);
      const gasUsed = randomBetween(1000, 500_000);
      const fail = gasUsed > gasLimit || randomBoolean();

      return {
        chain: randomElem(chains),
        sequenceNumber: Math.floor(randomBetween(10_000, 100_100)),
        provider: `0x${randomHex(42)}`,
        sender: `0x${randomHex(42)}`,
        requestTxHash: `0x${randomHex(42)}`,
        gasLimit,
        requestTimestamp: new Date(),
        hasCallbackCompleted: completed,
        userRandomNumber: `0x${randomHex(42)}`,
        ...(completed && {
          callbackTxHash: `0x${randomHex(42)}`,
          callbackFailed: fail,
          randomNumber: `0x${randomHex(10)}`,
          returnValue:
            !fail || gasUsed > gasLimit
              ? ""
              : randomElem(Object.keys(ERROR_DETAILS)),
          gasUsed,
          callbackTimestamp: new Date(),
        }),
      };
    }),
  );
};

const range = (i: number) => [...Array.from({ length: i }).keys()];

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const randomBoolean = (): boolean => Math.random() < 0.5;

const randomHex = (length: number) =>
  Array.from({ length })
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");

const randomElem = <T>(arr: T[] | readonly T[]) =>
  arr[Math.floor(randomBetween(0, arr.length))];

const chains = [
  "arbitrum",
  "base",
  "optimism",
  "baseSepolia",
  "optimismSepolia",
] as const;

const hexStringSchema = z.custom<`0x${string}`>(
  (val) => typeof val === "string" && val.startsWith("0x"),
);
const schemaBase = z.strictObject({
  chain: z.enum(chains),
  sequenceNumber: z.number(),
  provider: hexStringSchema,
  sender: hexStringSchema,
  requestTxHash: hexStringSchema,
  gasLimit: z.number(),
  userRandomNumber: hexStringSchema,
  requestTimestamp: z.date(),
});
const inProgressRequestScehma = schemaBase
  .extend({
    hasCallbackCompleted: z.literal(false),
  })
  .transform((args) => Request.Pending(args));
const completedRequestSchema = schemaBase
  .extend({
    hasCallbackCompleted: z.literal(true),
    callbackTxHash: hexStringSchema,
    callbackFailed: z.boolean(),
    randomNumber: hexStringSchema,
    returnValue: z.union([hexStringSchema, z.literal("")]),
    gasUsed: z.number(),
    callbackTimestamp: z.date(),
  })
  .transform((args) =>
    args.callbackFailed
      ? Request.CallbackErrored(args)
      : Request.Complete(args),
  );
const requestSchema = z.union([
  inProgressRequestScehma,
  completedRequestSchema,
]);
const requestsSchema = z.array(requestSchema);

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
  userRandomNumber: `0x${string}`;
};
type PendingArgs = BaseArgs;
type RevealedBaseArgs = BaseArgs & {
  callbackTxHash: `0x${string}`;
  randomNumber: `0x${string}`;
  gasUsed: number;
  callbackTimestamp: Date;
};
type CallbackErrorArgs = RevealedBaseArgs & {
  returnValue: "" | `0x${string}`;
};
type CompleteArgs = RevealedBaseArgs;

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
