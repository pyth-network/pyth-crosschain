#!/usr/bin/env node

import fs from "fs/promises";
import path from "node:path";
import { build } from "tsdown";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * returns the path of the found tsconfig file
 * or uses the provided override, instead,
 * if it's available
 *
 * @param {string} cwd
 * @param {string | undefined | null} tsconfigOverride
 */
async function findTsconfigFile(cwd, tsconfigOverride) {
  if (tsconfigOverride) {
    const overridePath = path.isAbsolute(tsconfigOverride)
      ? tsconfigOverride
      : path.join(cwd, tsconfigOverride);
    return overridePath;
  }

  const locations = [
    path.join(cwd, "tsconfig.build.json"),
    path.join(cwd, "tsconfig.json"),
  ];

  for (const fp of locations) {
    try {
      const stat = await fs.stat(fp);
      if (stat.isFile()) return fp;
    } catch {}
  }
  return null;
}

/**
 * builds a typescript package, using tsdown and its Node-friendly API
 * @returns {Promise<void>}
 */
export async function buildTsPackage(argv = process.argv) {
  const yargs = createCLI(hideBin(argv));
  const {
    all,
    cwd,
    noCjs,
    noDts,
    noEsm,
    outDir,
    tsconfig: tsconfigOverride,
    watch,
  } = await yargs
    .scriptName("build-ts-package")
    .option("all", {
      default: false,
      description:
        "if true, will compile ALL files in your source folder and link them to your package.json. this is only required if you do not have an index.ts or index.tsx entrypoint that exports all of the things you want users to use.",
      type: "boolean",
    })
    .option("cwd", {
      default: process.cwd(),
      description: "the CWD to use when building",
      type: "string",
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

  /** @type {import('tsdown').Format} */
  const format = [noCjs ? undefined : "cjs", noEsm ? undefined : "esm"].filter(
    (format) => Boolean(format),
  );

  const tsconfig = await findTsconfigFile(cwd, tsconfigOverride);

  if (!tsconfig) {
    throw new Error(`unable to build ${cwd} because no tsconfig was found`);
  }

  await build({
    dts: !noDts,
    entry: [
      "./src/**/*.ts",
      "./src/**/*.tsx",
      "!./src/**/*.stories.ts",
      "!./src/**/*.stories.tsx",
      "!./src/**/*.stories.mdx", // if you use MDX stories
    ],
    exports: all ? { all: true } : true,
    external: [/\.s?css$/, /\.svg$/],
    format,
    outDir: outDirPath,
    platform: "neutral",
    plugins: [],
    tsconfig,
    unbundle: true,
    watch,
  });
}

await buildTsPackage();
