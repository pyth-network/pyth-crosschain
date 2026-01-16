import { makeCssFuncs } from 'simplestyle-js';

import { getRegistryInstance } from './registry.js';
import { Theme } from './theme.js';

export const { createStyles, imports, keyframes, rawStyles } = makeCssFuncs(() => ({
  registry: getRegistryInstance(),
  variables: Theme,
}));