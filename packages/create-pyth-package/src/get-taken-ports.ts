import path from "node:path";

import fs from "fs-extra";
import type { PackageJson } from "type-fest";

import { getAllMonorepoPackages } from "./get-all-monorepo-packages.js";

/**
 * scrapes the entire monorepo to see what next.js ports
 * are already taken and returns a Set() containing these ports
 * to assist the user in choosing one that doesn't have a collision
 */
export function getTakenPorts() {
  // "start:dev": "next dev --port 3003",
  //   "start:prod": "next start --port 3003",
  const allPackages = getAllMonorepoPackages();

  const out = new Set<number>();

  for (const info of allPackages) {
    const pjsonPath = path.join(info.path, "package.json");
    const pjson = JSON.parse(fs.readFileSync(pjsonPath, "utf8")) as PackageJson;
    const scripts = pjson.scripts ?? {};

    for (const scriptVal of Object.values(scripts)) {
      if (!scriptVal) continue;
      if (!scriptVal.includes("next ")) continue;

      const [, portViaFlagStr = ""] = /--port\s+(\d+)/.exec(scriptVal) ?? [];
      const [, portViaEnvStr = ""] = /^PORT=(\d+)/.exec(scriptVal) ?? [];
      const port = Number(portViaFlagStr || portViaEnvStr);

      if (!Number.isNaN(port)) out.add(port);
    }
  }

  return out;
}
