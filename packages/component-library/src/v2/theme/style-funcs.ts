import { makeCssFuncs } from "simplestyle-js/ssr";

import { ThemeV2 } from "./theme";

export const { createImports, createKeyframes, createRawStyles, createStyles } =
  makeCssFuncs({ variables: ThemeV2 });
