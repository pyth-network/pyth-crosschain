import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidTxHash(hash: string) {
  const cleanHash = hash.toLowerCase().replace('0x', '');
  return /^[a-f0-9]{64}$/.test(cleanHash);
}

