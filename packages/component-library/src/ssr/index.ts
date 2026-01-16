import { SimpleStyleRegistry } from 'simplestyle-js';

import { setRegistryInstance } from '../styles/registry';

setRegistryInstance(new SimpleStyleRegistry());

// re-export everything so that they all get the css-in-js registry
// changes
export * from '../index.js';