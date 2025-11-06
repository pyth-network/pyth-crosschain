// this file exists as a way to export a single, unified instance of
// the nuqs library, to prevent the following error:
// https://nuqs.dev/NUQS-404
// solutions have been discussed here about using nuqs in a monorepo:
// https://github.com/47ng/nuqs/issues/798
// NOTE: this helps prevent mixed ESM and CJS usages of the hooks and context providers,
// which is likely what causes the issue in bundler environments that support both
// and aren't strictly opinionated about CJS vs ESM
export * from "nuqs";
