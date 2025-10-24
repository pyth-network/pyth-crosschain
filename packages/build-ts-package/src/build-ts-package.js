#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

import { findTsconfigFile } from "./find-tsconfig-file.js";
import { execAsync } from "./exec-async.js";

const DEFAULT_EXCLUSION_PATTERNS = [
  "!./src/**/*.stories.ts",
  "!./src/**/*.test.ts",
  "!./src/**/*.test.tsx",
  "!./src/**/*.spec.ts",
  "!./src/**/*.spec.tsx",
  "!./src/**/*.stories.tsx",
  "!./src/**/*.stories.mdx",
];

/**
 * @typedef {'cjs' | 'esm'} ModuleType
 */

/**
 * builds a typescript package, using tsdown and its Node-friendly API
 * @returns {Promise<void>}
 */
export async function buildTsPackage(argv = process.argv) {
  const yargs = createCLI(hideBin(argv));
  const {
    cwd,
    exclude,
    noCjs,
    noDts,
    noEsm,
    outDir,
    tsconfig: tsconfigOverride,
    watch,
  } = await yargs
    .scriptName("build-ts-package")
    .option("cwd", {
      default: process.cwd(),
      description: "the CWD to use when building",
      type: "string",
    })
    .option("exclude", {
      default: [],
      description:
        "one or more glob patterns of files to ignore during compilation.",
      type: "array",
    })
    .option("noCjs", {
      default: false,
      description:
        "if true, will not build the CommonJS variant of this package",
      type: "boolean",
    })
    .option("noDts", {
      default: false,
      description: "if set, will not write typescript typings",
      type: "boolean",
    })
    .option("noEsm", {
      default: false,
      description: "if true, will not build the ESM variant of this package",
      type: "boolean",
    })
    .option("outDir", {
      default: "dist",
      description: "the folder where the built files will be written",
      type: "string",
    })
    .option("tsconfig", {
      description:
        "if provided, will explicitly use this tsconfig.json location instead of searching for a tsconfig.build.json or a plain tsconfig.json",
      type: "string",
    })
    .option("watch", {
      default: false,
      description:
        "if set, will automatically watch for any changes to this library and rebuild, making it easier for you to consume changes in the monorepo while doing local development",
      type: "boolean",
    })
    .help().argv;

  const outDirPath = path.isAbsolute(outDir) ? outDir : path.join(cwd, outDir);

  // ESM Must come before CJS, as those typings and such take precedence
  // when dual publishing.
  const formats = /** @type {ModuleType[]} */ (
    [noEsm ? undefined : "esm", noCjs ? undefined : "cjs"].filter(Boolean)
  );

  const tsconfig = await findTsconfigFile(cwd, tsconfigOverride);

  if (!tsconfig) {
    throw new Error(`unable to build ${cwd} because no tsconfig was found`);
  }

  const pjsonPath = path.join(path.dirname(tsconfig), "package.json");

  const numFormats = formats.length;

  for (const format of formats) {
    console.info(`building ${format} variant in ${cwd}`);
    console.info(`  tsconfig: ${tsconfig}`);

    const outDir = numFormats <= 1 ? outDirPath : path.join(outDirPath, format);

    let cmd = `pnpm tsc --project ${tsconfig} --outDir ${outDir} --declaration ${!noDts} --module ${format === 'cjs' ? 'commonjs' : 'esnext'} --target esnext --resolveJsonModule false`;
    if (watch) cmd += ` --watch`;

    await execAsync(cmd, { cwd, stdio: 'inherit', verbose: true });

    
  }
  // if (numFormats > 1) {
  //   // we need to manually set the cjs exports, since tsdown
  //   // isn't yet capable of doing this for us
  //   /** @type {import('type-fest').PackageJson} */
  //   const pjson = JSON.parse(await fs.readFile(pjsonPath, "utf8"));
  //   if (!pjson.publishConfig?.exports) return;
  //   for (const exportKey of Object.keys(pjson.publishConfig.exports)) {
  //     // @ts-expect-error - we can definitely index here, so please be silenced!
  //     const exportPath = String(pjson.publishConfig.exports[exportKey]);

  //     // skip over all package.json files
  //     if (exportPath.includes("package.json")) continue;

  //     // @ts-expect-error - we can definitely index here, so please be silenced!
  //     pjson.publishConfig.exports[exportKey] = {
  //       import: exportPath,
  //       require: exportPath
  //         .replace(path.extname(exportPath), ".cjs")
  //         .replace(`${path.sep}esm${path.sep}`, `${path.sep}cjs${path.sep}`),
  //       types: exportPath.replace(path.extname(exportPath), ".d.ts"),
  //     };
  //     if (pjson.main) {
  //       pjson.main = pjson.main
  //         .replace(`${path.sep}esm${path.sep}`, `${path.sep}cjs${path.sep}`)
  //         .replace(/\.mjs$/, ".js");
  //     }
  //   }

  //   await fs.writeFile(pjsonPath, JSON.stringify(pjson, undefined, 2), "utf8");
  // }
}

await buildTsPackage();
