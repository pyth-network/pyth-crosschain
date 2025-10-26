/**
 * @typedef {import('type-fest').PackageJson} PackageJson
 */

import { Logger } from './logger.js';

/**
 * @typedef {Object} Config
 * @property {PackageJson['exports']} [extraExports=undefined]
 */

/**
 * @typedef {Object} PackageJsonWithPossibleConfig
 * @property {Config} build-ts-package
 */

/**
 * takes the package.json blob and smears some additional
 * export statements into the existing block, if avaialble
 * 
 * @param {PackageJson & PackageJsonWithPossibleConfig} pjson 
 */
export function injectExtraExports(pjson) {
  const config = pjson['build-ts-package'];

  if (!config?.extraExports) return pjson;

  Logger.info('config.extraExports', JSON.stringify(config.extraExports));

  return {
    ...pjson,
    exports: {
      // @ts-expect-error - type mismatch between type-fest and here
      ...pjson.exports,
      // @ts-expect-error - type mismatch between type-fest and here
      ...config.extraExports,
    },
  };
}