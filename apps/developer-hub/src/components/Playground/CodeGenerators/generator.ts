import type { CodeLanguage, PlaygroundConfig } from "../types";
import { generateCliCode } from "./cli";
import { generateGoCode } from "./go";
import { generatePythonCode } from "./python";
import { generateTypeScriptCode } from "./typescript";

/**
 * Generates code for the specified language based on the playground configuration
 */
export function generateCode(
  language: CodeLanguage,
  config: PlaygroundConfig,
): string {
  switch (language) {
    case "typescript": {
      return generateTypeScriptCode(config);
    }
    case "cli": {
      return generateCliCode(config);
    }
    case "go": {
      return generateGoCode(config);
    }
    case "python": {
      return generatePythonCode(config);
    }
    default: {
      // Exhaustive check - this should never happen
      const exhaustiveCheck: never = language;
      throw new Error(`Unknown language: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Returns the file extension for the given language
 */
export function getFileExtension(language: CodeLanguage): string {
  switch (language) {
    case "typescript": {
      return "ts";
    }
    case "cli": {
      return "sh";
    }
    case "go": {
      return "go";
    }
    case "python": {
      return "py";
    }
    default: {
      const exhaustiveCheck: never = language;
      throw new Error(`Unknown language: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Returns the Monaco editor language ID for the given code language
 */
export function getMonacoLanguage(language: CodeLanguage): string {
  switch (language) {
    case "typescript": {
      return "typescript";
    }
    case "cli": {
      return "shell";
    }
    case "go": {
      return "go";
    }
    case "python": {
      return "python";
    }
    default: {
      const exhaustiveCheck: never = language;
      throw new Error(`Unknown language: ${String(exhaustiveCheck)}`);
    }
  }
}
