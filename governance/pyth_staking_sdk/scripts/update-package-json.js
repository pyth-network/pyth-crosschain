import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distPackageJsonPath = path.join(__dirname, "..", "dist", "package.json");

// Read the original package.json
const packageJson = JSON.parse(fs.readFileSync(distPackageJsonPath, "utf8"));

// Modify the exports field
packageJson.exports = {
  ".": "./src/index.js",
};

// Write the modified package.json to the dist folder
fs.writeFileSync(distPackageJsonPath, JSON.stringify(packageJson, null, 2));
