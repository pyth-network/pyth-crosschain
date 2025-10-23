#!/usr/bin/env node

import fs from "fs/promises";
import path from "node:path";
import { build } from "tsdown";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * @typedef {import('tsdown').Format} Format
 */

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
    exclude,
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
    .option('exclude', {
      default: [],
      description: 'one or more file exclusion glob patterns. please note, these must be EXCLUSION glob patterns, or they may end up getting picked up by the build',
      type: 'array',
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
  const formats = /** @type {Format[]} */ (
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

    await build({
      clean: false,
      cwd,
      dts: !noDts,
      entry: [
        "./src/**/*.ts",
        "./src/**/*.tsx",
        // ignore all storybook entrypoints
        "!./src/**/*.stories.ts",
        "!./src/**/*.test.ts",
        "!./src/**/*.test.tsx",
        "!./src/**/*.spec.ts",
        "!./src/**/*.spec.tsx",
        "!./src/**/*.stories.tsx",
        "!./src/**/*.stories.mdx",
        ...(exclude.map(ex => String(ex))),
      ],
      exports:
        format === "esm" || numFormats <= 1 ? { all, devExports: true } : false,
      // do not attempt to resolve or import CSS, SCSS or SVG files
      external: [/\.s?css$/, /\.svg$/],
      format,
      outDir: path.join(outDirPath, format),
      platform: "neutral",
      tsconfig,
      unbundle: true,
      watch,
    });
  }
  if (numFormats > 1) {
    // we need to manually set the cjs exports, since tsdown
    // isn't yet capable of doing this for us
    /** @type {import('type-fest').PackageJson} */
    const pjson = JSON.parse(await fs.readFile(pjsonPath, "utf8"));
    if (!pjson.publishConfig?.exports) return;
    for (const exportKey of Object.keys(pjson.publishConfig.exports)) {
      // @ts-expect-error - we can definitely index here, so please be silenced!
      const exportPath = String(pjson.publishConfig.exports[exportKey]);

      // skip over all package.json files
      if (exportPath.includes('package.json')) continue;

      // @ts-expect-error - we can definitely index here, so please be silenced!
      pjson.publishConfig.exports[exportKey] = {
        import: exportPath,
        require: exportPath
          .replace(path.extname(exportPath), ".cjs")
          .replace(`${path.sep}esm${path.sep}`, `${path.sep}cjs${path.sep}`),
        types: exportPath.replace(path.extname(exportPath), ".d.ts"),
      };
      if (pjson.main) {
        pjson.main = pjson.main.replace(`${path.sep}esm${path.sep}`, `${path.sep}cjs${path.sep}`);
      }
    }

    await fs.writeFile(pjsonPath, JSON.stringify(pjson, undefined, 2), "utf8");
  }
}

await buildTsPackage();
