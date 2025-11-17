// jest prefers CJS environments, so this is a bit of a hack
// to properly assign React as a global for all tests
import("react").then(({ default: React }) => {
  globalThis.React = React;
});
