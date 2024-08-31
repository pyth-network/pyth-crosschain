import { BN } from "@coral-xyz/anchor";
import { ConvertBigIntToBN, ConvertBNToBigInt } from "./types";

export const convertBNToBigInt = <T>(obj: T): ConvertBNToBigInt<T> => {
  if (obj instanceof BN) {
    return BigInt(obj.toString()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBNToBigInt) as any;
  }
  if (typeof obj !== "object" || obj === null || obj.constructor !== Object) {
    return obj as any;
  }

  let newObj = {} as any;
  for (const key in obj) {
    if (obj[key] instanceof BN) {
      newObj[key] = BigInt(obj[key].toString());
    } else {
      newObj[key] = convertBNToBigInt(obj[key]);
    }
  }
  return newObj;
};

export const convertBigIntToBN = <T>(obj: T): ConvertBigIntToBN<T> => {
  if (typeof obj === "bigint") {
    return new BN(obj.toString()) as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToBN) as any;
  }
  if (typeof obj !== "object" || obj === null || obj.constructor !== Object) {
    return obj as any;
  }
  let newObj = {} as any;
  for (const key in obj) {
    if (typeof obj[key] === "bigint") {
      newObj[key] = new BN(obj[key].toString());
    } else {
      newObj[key] = convertBigIntToBN(obj[key]);
    }
  }
  return newObj;
};
