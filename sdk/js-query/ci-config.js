process.env.CI = true;

const warn = console.warn;
console.warn = function (x) {
  if (
    x !==
    "bigint: Failed to load bindings, pure JS will be used (try npm run rebuild?)"
  ) {
    warn(x);
  }
};

module.exports = {};
