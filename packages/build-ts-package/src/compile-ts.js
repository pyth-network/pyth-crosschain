import { build } from "esbuild";
import { transformFile } from "@swc/core";
import { execAsync } from "./exec-async.js";
import fs from "fs-extra";
import path from "node:path";
import { Logger } from "./logger.js";
import { createResolver } from "./resolve-import-path.js";
import glob from "fast-glob";

/**
 * @typedef {'cjs' | 'esm'} ModuleType
 */

/**
 * @typedef {'babel' | 'esbuild' | 'swc'} Compiler
 */

/** @typedef {import('esbuild').Platform} Platform */

/** @type {Platform[]} */
export const AVAILABLE_PLATFORMS = ["browser", "neutral", "node"];

/** @type {Compiler[]} */
export const AVAILABLE_COMPILERS = ["babel", "esbuild", "swc"];

/**
 * @typedef {Object} CompileTsOpts
 * @property {Compiler} compiler
 * @property {string} cwd
 * @property {string[]} entryPoints
 * @property {ModuleType} format
 * @property {boolean} noDts
 * @property {string} outDir
 * @property {Platform} platform
 * @property {string} tsconfig
 * @property {boolean} watch
 */

/**
 * compiles typescript, using any build utility of your choosing
 *
 * @param {CompileTsOpts} opts
 */
export async function compileTs({
  compiler,
  cwd,
  entryPoints,
  format,
  noDts,
  outDir,
  platform,
  tsconfig,
  watch,
}) {
  const outExtension = ".js";

  const filesToCompile = entryPoints
    .filter((ep) => /\.(j|t)sx?$/.test(ep))
    .filter((ep) => !ep.endsWith(".d.ts"));

  Logger.info("using the", compiler, "compiler");

  switch (compiler) {
    case "babel":
      await Promise.resolve();
      break;
    case "esbuild":
      await build({
        absWorkingDir: cwd,
        bundle: false,
        entryPoints: filesToCompile,
        format,
        outdir: outDir,
        platform,
        sourcemap: false,
        splitting: false,
        target: "esnext",
      });
      break;
    case "swc":
      await Promise.all(
        filesToCompile.map(async (fp) => {
          const absFp = path.isAbsolute(fp) ? fp : path.join(cwd, fp);
          const relThing = path.relative(cwd, absFp);

          const outFilePath = path.join(
            outDir,
            ...relThing
              .replace(path.extname(fp), ".js")
              .split(path.sep)
              .slice(1)
              .filter(Boolean),
          );

          const { code } = await transformFile(fp, {
            cwd,
            jsc: {
              target: "esnext",
              transform: {
                react: {
                  // React 17+ support.
                  // if you're on a legacy version, sorry
                  runtime: 'automatic',
                },
              },
            },
            module: {
              outFileExtension: "js",
              resolveFully: true,
              strict: true,
              type: format === "esm" ? "es6" : "commonjs",
            },
            outputPath: outDir,
            sourceMaps: false,
          });

          await fs.ensureFile(outFilePath);
          await fs.writeFile(outFilePath, code, "utf8");
        }),
      );
      break;
    default:
      throw new Error(
        `an invalid compiler value of ${compiler} was provided when compiling typescript`,
      );
  }
  let cmd =
    `pnpm tsc --project ${tsconfig} --outDir ${outDir} --declaration ${!noDts} --emitDeclarationOnly ${!noDts} --module ${format === "cjs" ? "nodenext" : "esnext"} --target esnext --resolveJsonModule false ${format === "cjs" ? "--moduleResolution nodenext" : ""}`.trim();
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

  // Matches ESM import/export statements and captures the module specifier
  const esmRegex =
    /\bimport\s+(?:[\s\S]*?\bfrom\s+)?(['"])([^'"]+)\1|\bexport\s+(?:[\s\S]*?\bfrom\s+)(['"])([^'"]+)\3/g;

  await Promise.all(
    absoluteBuiltFiles.map(async (absFp) => {
      if (absFp.endsWith(".d.ts")) return;

      let contents = await fs.readFile(absFp, "utf8");

      contents = contents.replace(esmRegex, (full, _q1, imp1, _q2, imp2) => {
        const importPath = imp1 || imp2;
        const resolveImport = createResolver(absFp);
        const { resolved, resolvedRelative } = resolveImport(importPath);

        if (!resolved.startsWith(outDir)) return full;

        // Compute the new path:
        // - If the specifier has an extension, replace it.
        // - If it doesn't, append the desired extension.
        const ext = path.extname(resolvedRelative);
        let newPath = ext
          ? resolvedRelative.replace(ext, outExtension)
          : `${resolvedRelative}${outExtension}`;

        if (!newPath.startsWith('.') && !newPath.startsWith('/')) {
          newPath = `./${newPath}`;
        }

        if (/\.jsx?/.test(resolved)) {
          // Replace only inside the matched statement to avoid accidental global replacements.
          const out = full.replace(importPath, newPath);

          return out;
        }
        return full;
      });

      await fs.writeFile(absFp, contents, "utf8");
    }),
  );

  return absoluteBuiltFiles;
}
