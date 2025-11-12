import path from "node:path";

import appRootPath from "app-root-path";

import { getAllMonorepoPackages } from "./get-all-monorepo-packages.js";

const repoRoot = appRootPath.toString();

/**
 * scans the entire pythcrosschain repo for all of the folders
 * that have package.json files and returns the unique list of all parent
 * directories for those, as a way to present the folder choice to the user.
 */
export function getAvailableFolders() {
  const allPackages = getAllMonorepoPackages();

  return [
    ...new Set(
      allPackages
        .filter((info) => info.path !== repoRoot)
        .map((info) => {
          const sPath = info.path.split(path.sep);
          return path.relative(repoRoot, sPath.slice(0, -1).join(path.sep));
        })
        .filter(Boolean),
    ),
  ];
}
