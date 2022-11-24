const dotenv = require("dotenv");
var path = require("path");

module.exports = function loadEnv(rootPath) {
  dotenv.config({ path: path.join(rootPath, ".env") });
  if (process.env.CLUSTER !== undefined) {
    dotenv.config({
      path: path.join(rootPath, `.env.cluster.${process.env.CLUSTER}`),
    });
  }
};
