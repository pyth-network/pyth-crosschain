export function sleep(ms: number) {
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
