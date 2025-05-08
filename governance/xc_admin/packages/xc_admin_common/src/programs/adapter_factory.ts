import { ProgramAdapter } from "./program_adapter";
import { ProgramType } from "./types";
import { PythCoreAdapter } from "./core/core_adapter";
import { PythLazerAdapter } from "./lazer/lazer_adapter";

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
      return new PythCoreAdapter();
    case ProgramType.PYTH_LAZER:
      return new PythLazerAdapter();
    default:
      const exhaustiveCheck: never = type;
      throw new Error(`Unknown program type: ${exhaustiveCheck}`);
  }
}
