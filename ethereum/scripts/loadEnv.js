const dotenv = require("dotenv");
var path = require("path");

/**
 * Load environment variables for truffle. This method will load some
 * cluster-wide environment variables if `CLUSTER` is set in
 * `{rootPath}/.env`.
 * @param {string} rootPath
 */
module.exports = function loadEnv(rootPath) {
  dotenv.config({ path: path.join(rootPath, ".env") });
  if (process.env.CLUSTER !== undefined) {
    dotenv.config({
      path: path.join(rootPath, `.env.cluster.${process.env.CLUSTER}`),
    });
  }
};
