export type HexString = string;
export type UnixTimestampInString = string;
export type NumberInString = string;

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Shorthand for optional/mandatory envs
export function envOrErr(env: string): string {
  let val = process.env[env];
  if (!val) {
    throw `environment variable "${env}" must be set`;
  }
  return String(process.env[env]);
}

export async function waitForCondition(cond: () => boolean, timeoutInMs: number): Promise<boolean> {
  var timedOut = false;

  setTimeout(() => {timedOut = true;}, timeoutInMs);

  while(timedOut === false && !cond()) {
    await sleep(100);
  }

  return !timedOut;
}
