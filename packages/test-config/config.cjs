const reactPlugin = require("@vitejs/plugin-react");
const { defineConfig } = require("vitest/config");

Object.assign(exports, require("vitest"));

function defineTestConfig(config) {
  return defineConfig({
    ...config,
    plugins: [
      ...(config && config.plugins ? config.plugins : []),
      reactPlugin(),
    ],
    test: {
      ...(config && config.test ? config.test : {}),
      environment:
        config && config.environment ? config.environment : "happy-dom",
    },
  });
}

exports.defineTestConfig = defineTestConfig;
