// Jest doesn't compile CSS modules, so hand back each requested key as its own
// class name. That lets component tests assert on which classes get applied.
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === "__esModule" ? false : key),
  },
);
