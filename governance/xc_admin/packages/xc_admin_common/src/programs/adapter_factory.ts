import { ProgramAdapter } from "./program_adapter";
import { ProgramType } from "./types";

/**
 * Factory function to get the appropriate program adapter based on program type.
 *
 * @param type The type of program to get the adapter for
 * @returns The corresponding program adapter
 * @throws Error if the adapter for the given program type is not implemented
 */
export function getProgramAdapter(type: ProgramType): ProgramAdapter {
  switch (type) {
    case ProgramType.PYTH_CORE:
      // Will be implemented in a future commit
      throw new Error("Pyth Core adapter not yet implemented");
    case ProgramType.PYTH_LAZER:
      // Will be implemented in a future commit
      throw new Error("Pyth Lazer adapter not yet implemented");
    default:
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown program type: ${exhaustiveCheck}`);
  }
}
