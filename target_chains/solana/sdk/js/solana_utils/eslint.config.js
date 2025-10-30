import { base } from "@cprussin/eslint-config";
import { globalIgnores } from "eslint/config";

export default [globalIgnores(["src/__tests__/**/*"]), ...base];
