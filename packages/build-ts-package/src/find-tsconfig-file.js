import fs from "node:fs/promises";
import path from "node:path";

/**
 * returns the path of the found tsconfig file
 * or uses the provided override, instead,
 * if it's available
 *
 * @param {string} cwd
 * @param {string | undefined | null} tsconfigOverride
 */
export async function findTsconfigFile(cwd, tsconfigOverride) {
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
