import { execSync } from "node:child_process";
import path from "node:path";

const jestBinFilePath = path.join(
  import.meta.dirname,
  "node_modules",
  ".bin",
  "jest",
);

// necessary evil to allow all Jest users
// to benefit from ESM imports and use
// our shared configs (especially for React component tests)
execSync(
  `NODE_OPTIONS="--experimental-vm-modules" '${jestBinFilePath}' ${process.argv.slice(2).join(" ")}`.trim(),
  {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
  },
);
