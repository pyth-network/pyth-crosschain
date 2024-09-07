export const DECIMALS = 6;

export const tokensToString = (value: bigint): string => {
  const asStr = value.toString();
  const whole =
    asStr.length > DECIMALS ? asStr.slice(0, asStr.length - DECIMALS) : "0";
  const decimal =
    asStr.length > DECIMALS ? asStr.slice(asStr.length - DECIMALS) : asStr;
  const decimalPadded = decimal.padStart(DECIMALS, "0");
  const decimalTruncated = decimalPadded.replace(/0+$/, "");

  return [
    whole,
    ...(decimalTruncated === "" ? [] : [".", decimalTruncated]),
  ].join("");
};

export const stringToTokens = (value: string): bigint | undefined => {
  const [whole, decimal] = value.split(".");
  try {
    return BigInt(
      `${whole ?? "0"}${(decimal ?? "").slice(0, DECIMALS).padEnd(DECIMALS, "0")}`,
    );
  } catch {
    return undefined;
  }
};
