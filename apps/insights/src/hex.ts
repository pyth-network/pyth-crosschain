import base58 from "bs58";

export const toHex = (value: string) =>
  `0x${Array.from(base58.decode(value), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

export const truncateHex = (value: string) =>
  `${value.slice(0, 6)}...${value.slice(-4)}`;
