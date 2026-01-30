import { ThemeV2 } from "@pythnetwork/component-library/v2/theme";
import { makeCssFuncs } from "simplestyle-js/ssr";

export const { createImports, createKeyframes, createRawStyles, createStyles } =
  makeCssFuncs({ variables: ThemeV2 });
