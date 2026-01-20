import { theme } from "@pythnetwork/component-library/styles/theme";
import { makeCssFuncs } from "simplestyle-js/ssr";

export const { createImports, createKeyframes, createRawStyles, createStyles } =
  makeCssFuncs({ variables: theme });
