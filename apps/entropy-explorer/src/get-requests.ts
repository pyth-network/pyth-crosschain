import { z } from "zod";

const MOCK_DATA_SIZE = 20;

export const getRequests = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return requestsSchema.parse(
    range(MOCK_DATA_SIZE).map((i) => {
      const completed = randomBoolean();
      const gasLimit = randomBetween(10_000, 1_000_000);
      const gasUsed = randomBetween(1000, 1_000_000);

      return {
        chain: randomElem(chains),
        sequenceNumber: MOCK_DATA_SIZE - i,
        provider: `0x${randomHex(42)}`,
        caller: `0x${randomHex(42)}`,
        txHash: `0x${randomHex(42)}`,
        gasLimit,
        timestamp: new Date().toLocaleString(),
        hasCallbackCompleted: completed,
        userRandomNumber: `0x${randomHex(42)}`,
        ...(completed && {
          callbackResult: {
            txHash: `0x${randomHex(42)}`,
            failed: gasUsed > gasLimit || randomBoolean(),
            randomNumber: `0x${randomHex(10)}`,
            returnValue: gasUsed > gasLimit ? "" : `0x${randomHex(10)}`, // "0xabcd1234", // will need to decode this in frontend. If failed == true, this contains the error code + additional debugging data. If it's "" and gasUsed is >= gasLimit, then it's an out of gas error.
            gasUsed,
            timestamp: new Date().toLocaleString(),
          },
        }),
      };
    }),
  );
};

const chains = [
  "arbitrum",
  "base",
  "optimism",
  "baseSepolia",
  "optimismSepolia",
] as const;

const schemaBase = z.strictObject({
  chain: z.enum(chains),
  sequenceNumber: z.number(),
  provider: z.string(),
  caller: z.string(),
  txHash: z.string(),
  gasLimit: z.number(),
  userRandomNumber: z.string(),
  timestamp: z.string().transform((value) => new Date(value)),
});
const inProgressRequestScehma = schemaBase.extend({
  hasCallbackCompleted: z.literal(false),
});
const completedRequestSchema = schemaBase.extend({
  hasCallbackCompleted: z.literal(true),
  callbackResult: z.strictObject({
    txHash: z.string(),
    failed: z.boolean(),
    randomNumber: z.string(),
    returnValue: z.string(),
    gasUsed: z.number(),
    timestamp: z.string().transform((value) => new Date(value)),
  }),
});
const requestSchema = z.union([
  inProgressRequestScehma,
  completedRequestSchema,
]);
const requestsSchema = z.array(requestSchema);

export type Request = z.infer<typeof requestSchema>;
export type CompletedRequest = z.infer<typeof completedRequestSchema>;

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
