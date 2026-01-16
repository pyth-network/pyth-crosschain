/**
 * HACK ALERT: There are some react hooks
 * that are importing things from coral-xyz/anchor,
 * which is a huge offender of including node-only deps
 * in its library, even if it's supposed to have isomorphic exports.
 * Since the "correct" fix would require substantial rearchitecting
 * of this project, shimming accidental node imports with an
 * empty module is what we'll use.
 * this file is used in the nearest next.config.js for this project
 */
export {}
