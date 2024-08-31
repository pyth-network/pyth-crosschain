import { BN } from "@coral-xyz/anchor";
import { ConvertBigIntToBN, ConvertBNToBigInt } from "./types";

export const convertBNToBigInt = <T>(obj: T): ConvertBNToBigInt<T> => {
  let newObj = {} as any;
  for (const key in obj) {
    if (obj[key] instanceof BN) {
      newObj[key] = BigInt(obj[key].toString());
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};

export const convertBigIntToBN = <T>(obj: T): ConvertBigIntToBN<T> => {
  let newObj = {} as any;
  for (const key in obj) {
    if (typeof obj[key] === "bigint") {
      newObj[key] = new BN(obj[key].toString());
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};
