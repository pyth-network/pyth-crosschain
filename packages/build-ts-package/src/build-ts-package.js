#!/usr/bin/env node

import glob from "fast-glob";
import fs from "fs-extra";
import path from "node:path";
import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

import { findTsconfigFile } from "./find-tsconfig-file.js";
import { execAsync } from "./exec-async.js";
import { generateTsconfigs } from "./generate-tsconfigs.js";
import { Logger } from "./logger.js";
import chalk from "chalk";

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
    clean,
    cwd,
    generateTsconfig,
    noCjs,
    noDts,
    noEsm,
    outDir,
    tsconfig: tsconfigOverride,
    watch,
  } = await yargs
    .scriptName("build-ts-package")
    .option("clean", {
      default: false,
      description:
        "if set, will clean out the build dirs before compiling anything",
      type: "boolean",
    })
    .option("cwd", {
      default: process.cwd(),
      description: "the CWD to use when building",
      type: "string",
    })
    .option("generateTsconfig", {
      default: false,
      description:
        "if set, will NOT build, but instead, will generate reasonable default TSConfig files that will work with dual publishing, and in most other use cases, as well",
      type: "boolean",
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

  if (generateTsconfig) {
    return generateTsconfigs(cwd);
  }

  const outDirPath = path.isAbsolute(outDir) ? outDir : path.join(cwd, outDir);

  if (clean) await fs.remove(outDirPath);

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

  const pjson = JSON.parse(await fs.readFile(pjsonPath, "utf8"));
  // always freshly reset the exports and let the tool take over
  pjson.exports = {};

  Logger.info("building package", chalk.magenta(pjson.name));
  for (const format of formats) {
    try {
      Logger.info("building", chalk.magenta(format), "variant in", cwd);
      Logger.info("  tsconfig", chalk.magenta(tsconfig));

      const outDir =
        numFormats <= 1 ? outDirPath : path.join(outDirPath, format);

      let cmd =
        `pnpm tsc --project ${tsconfig} --outDir ${outDir} --declaration ${!noDts} --module ${format === "cjs" ? "nodenext" : "esnext"} --target esnext --resolveJsonModule false ${format === "cjs" ? "--moduleResolution nodenext" : ""}`.trim();
      if (watch) cmd += ` --watch`;

      await execAsync(cmd, { cwd, stdio: "inherit", verbose: true });

      const absoluteBuiltFiles = await glob(
        [
          path.join(outDir, "**", "*.d.ts"),
          path.join(outDir, "**", "*.js"),
          path.join(outDir, "**", "*.cjs"),
          path.join(outDir, "**", "*.mjs"),
        ],
        { absolute: true, onlyFiles: true },
      );

      const builtFiles = absoluteBuiltFiles
        .map((fp) => {
          const relPath = path.relative(outDir, fp);
          if (numFormats <= 1) return `.${path.sep}${relPath}`;
          return `.${path.sep}${path.join(format, relPath)}`;
        })
        .sort();

      const indexFile = builtFiles.find((fp) => {
        const r = /^\.(\/|\\)((cjs|esm)(\/|\\))?index\.(c|m)?js$/;
        return r.test(fp);
      });

      if (indexFile) {
        Logger.info("index file detected");
        if (format === "cjs" || numFormats <= 1) {
          // we use the legacy type of typing exports for the top-level
          // typings
          pjson.types = indexFile.replace(path.extname(indexFile), ".d.ts");
        }
        if (format === "esm") {
          pjson.module = indexFile;
        } else {
          pjson.main = indexFile;
        }
      }

      const exports =
        Array.isArray(pjson.exports) || typeof pjson.exports === "string"
          ? {}
          : (pjson.exports ?? {});

      const outDirBasename = path.basename(outDirPath);

      for (const fp of builtFiles) {
        const fpWithNoExt = fp
          .replace(/(\.d)?\.(c|m)?(js|ts)$/, "")
          .replaceAll(/\\/g, "/");
        const key = fpWithNoExt
          .replace(/(\/|\\)?index$/, "")
          .replace(/^\.(\/|\\)(cjs|esm)/, ".")
          .replaceAll(/\\/g, "/");
        const fpWithBasename = `./${path
          .join(outDirBasename, fp)
          .replaceAll(/\\/g, "/")}`;

        // Ensure key object exists
        const tempExports = exports[key] ?? {};

        // Add require/import entry without nuking the other
        if (format === "cjs") {
          tempExports.require = fpWithBasename;
        } else {
          tempExports.import = fpWithBasename;
        }

        // Also handle types if present
        if (
          (format === "esm" || numFormats <= 1) &&
          !noDts &&
          fp.endsWith(".d.ts")
        ) {
          tempExports.types = fpWithBasename;
        }
        exports[key] = tempExports;
      }

      pjson.exports = exports;

      Logger.info(chalk.green(`${pjson.name} - ${format} has been built!`));
    } catch (error) {
      Logger.error(
        "**building",
        pjson.name,
        chalk.underline(format),
        "variant has failed**",
      );
      throw error;
    }
  }

  pjson.exports["./package.json"] = "./package.json";
  await fs.writeFile(pjsonPath, JSON.stringify(pjson, null, 2), "utf8");
}

await buildTsPackage();
