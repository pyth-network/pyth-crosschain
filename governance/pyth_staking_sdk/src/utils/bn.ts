/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BN } from "@coral-xyz/anchor";

import type { ConvertBigIntToBN, ConvertBNToBigInt } from "../types.js";

export const convertBNToBigInt = <T>(obj: T): ConvertBNToBigInt<T> => {
  if (obj instanceof BN) {
    return BigInt(obj.toString()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((x) => convertBNToBigInt(x)) as any;
  }
  if (typeof obj !== "object" || obj === null || obj.constructor !== Object) {
    return obj as any;
  }

  const newObj: any = {};
  for (const key in obj) {
    newObj[key] =
      obj[key] instanceof BN
        ? BigInt(obj[key].toString())
        : convertBNToBigInt(obj[key]);
  }
  return newObj;
};

export const convertBigIntToBN = <T>(obj: T): ConvertBigIntToBN<T> => {
  if (typeof obj === "bigint") {
    return new BN(obj.toString()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map((x) => convertBigIntToBN(x)) as any;
  }
  if (typeof obj !== "object" || obj === null || obj.constructor !== Object) {
    return obj as any;
  }
  const newObj: any = {};
  for (const key in obj) {
    newObj[key] =
      typeof obj[key] === "bigint"
        ? new BN(obj[key].toString())
        : convertBigIntToBN(obj[key]);
  }
  return newObj;
};
