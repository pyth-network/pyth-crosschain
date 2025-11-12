import { execSync } from "node:child_process";

import appRootPath from "app-root-path";

export type PNPMPackageInfo = {
  name: string;
  path: string;
  private: boolean;
  version: string;
};

/**
 * returns basic info about all of the monorepo packages available in
 * the pyth crosschain repo
 */
export function getAllMonorepoPackages(repoRoot = appRootPath.toString()) {
  const allPackages = JSON.parse(
    execSync("pnpm list --recursive --depth -1 --json", {
      cwd: repoRoot,
      stdio: "pipe",
    }).toString("utf8"),
  ) as PNPMPackageInfo[];

  return allPackages;
}
