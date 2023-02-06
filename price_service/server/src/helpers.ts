// Time in seconds
export type TimestampInSec = number;
export type DurationInSec = number;
export type DurationInMs = number;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shorthand for optional/mandatory envs
export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

export function parseToOptionalNumber(
  s: string | undefined
): number | undefined {
  if (s === undefined) {
    return undefined;
  }

  return parseInt(s, 10);
}

export function removeLeading0x(s: string): string {
  if (s.startsWith("0x")) {
    return s.substring(2);
  }

  return s;
}
