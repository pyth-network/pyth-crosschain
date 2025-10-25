// resolver.js
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Create a resolver bound to the directory of a given file path.
 * @param {string} absFilePath - Absolute path to the file you read.
 * @returns {(specifier: string) => { resolved: string, hadExtension: boolean }}
 */
export function createResolver(absFilePath) {
  const absDir = path.dirname(absFilePath);

  // Bind Node's resolution to the given file (behaves as if that file did the import)
  const require = createRequire(pathToFileURL(absFilePath));

  return function resolve(specifier) {
    const hadExtension = /\.[a-zA-Z0-9]+$/.test(specifier);

    // Try Node's resolution first (handles bare specifiers, exports fields, node_modules, etc.)
    try {
      const resolved = require.resolve(specifier);
      return { resolved, hadExtension };
    } catch {
      // Fallback for simple relative specifiers; preserves original extension or lack thereof
      const resolved = path.resolve(absDir, specifier);
      return { resolved, hadExtension };
    }
  };
}
