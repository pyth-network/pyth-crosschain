import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * This script updates the package.json file in the dist directory after the TypeScript build.
 *
 * This ensures that the published package correctly references the compiled JavaScript
 * instead of the TypeScript source files.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distPackageJsonPath = path.join(__dirname, "..", "package.json");

const packageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, "utf8"));

packageJson.main = "dist/src/index.js";
packageJson.types = "dist/src/index.d.ts";

fs.writeFileSync(distPackageJsonPath, JSON.stringify(packageJson, null, 2));
