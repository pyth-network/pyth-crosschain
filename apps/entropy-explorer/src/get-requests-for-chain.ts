import { z } from "zod";

import type { EntropyDeployments } from "./entropy-deployments";

export const getRequestsForChain = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _chain: keyof typeof EntropyDeployments,
) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return resultSchema.parse(
    range(20).map((i) => {
      const completed = randomBoolean();
      return {
        sequenceNumber: i,
        provider: `0x${randomHex(42)}`,
        caller: `0x${randomHex(42)}`,
        txHash: `0x${randomHex(42)}`,
        gasLimit: randomBetween(10_000, 1_000_000),
        timestamp: new Date().toLocaleString(),
        hasCallbackCompleted: completed,
        ...(completed && {
          callbackResult: {
            failed: randomBoolean(),
            randomNumber: `0x${randomHex(10)}`,
            returnValue: `0x${randomHex(10)}`, // "0xabcd1234", // will need to decode this in frontend. If failed == true, this contains the error code + additional debugging data. If it's "" and gasUsed is >= gasLimit, then it's an out of gas error.
            gasUsed: randomBetween(1000, 1_000_000),
            timestamp: new Date().toLocaleString(), // datetime in some reasonable format
          },
        }),
      };
    }),
  );
};

const schemaBase = z.strictObject({
  sequenceNumber: z.number(),
  provider: z.string(),
  caller: z.string(),
  txHash: z.string(),
  gasLimit: z.number(),
  timestamp: z.string().transform((value) => new Date(value)),
});
const inProgressRequestScehma = schemaBase.extend({
  hasCallbackCompleted: z.literal(false),
});
const completedRequestSchema = schemaBase.extend({
  hasCallbackCompleted: z.literal(true),
  callbackResult: z.strictObject({
    failed: z.boolean(),
    randomNumber: z.string(),
    returnValue: z.string(),
    gasUsed: z.number(),
    timestamp: z.string().transform((value) => new Date(value)),
  }),
});
const resultSchema = z.array(
  z.union([inProgressRequestScehma, completedRequestSchema]),
);

const range = (i: number) => [...Array.from({ length: i }).keys()];

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const randomBoolean = (): boolean => Math.random() < 0.5;

const randomHex = (length: number) =>
  Array.from({ length })
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
