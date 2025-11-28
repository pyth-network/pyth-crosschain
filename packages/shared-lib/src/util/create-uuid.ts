import { v1, v4, v7 } from "uuid";

type UUIDType = "v1" | "v4" | "v7";

/**
 * creates a uuid of a specific variant.
 * if a variant isn't provided, a v4
 * variant is chosen as the default.
 */
export function createUUID(uuidType: UUIDType = "v4"): string {
  switch (uuidType) {
    case "v1": {
      return v1();
    }
    case "v4": {
      return v4();
    }
    case "v7": {
      return v7();
    }
  }
}
