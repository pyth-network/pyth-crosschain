import type { Options } from "yargs";

export const priceServiceEndpoint = {
  "price-service-endpoint": {
    description:
      "Endpoint URL for the hermes client. e.g: https://endpoint/example",
    required: true,
    type: "string",
  } as Options,
};

export const pythContractAddress = {
  "pyth-contract-address": {
    description:
      "Pyth contract address. Provide the network name on which Pyth is deployed " +
      "or the Pyth contract address if you use a local network.",
    required: true,
    type: "string",
  } as Options,
};

export const priceConfigFile = {
  "price-config-file": {
    description: "Path to price configuration YAML file.",
    required: true,
    type: "string",
  } as Options,
};

export const pollingFrequency = {
  "polling-frequency": {
    default: 5,
    description:
      "The frequency to poll price info data from the network if the RPC is not a websocket.",
    required: false,
    type: "number",
  } as Options,
};

export const pushingFrequency = {
  "pushing-frequency": {
    default: 10,
    description:
      "The frequency to push prices to the RPC. " +
      "It is better that the value be greater than the block time of the network, so this program confirms " +
      "it is updated and does not push it twice.",
    required: false,
    type: "number",
  } as Options,
};

export const mnemonicFile = {
  "mnemonic-file": {
    description: "Path to payer mnemonic (private key) file.",
    required: true,
    type: "string",
  } as Options,
};

export const logLevel = {
  "log-level": {
    choices: ["trace", "debug", "info", "warn", "error"],
    default: "info",
    description: "Log level",
    required: false,
    type: "string",
  } as Options,
};

export const controllerLogLevel = {
  "controller-log-level": {
    choices: ["trace", "debug", "info", "warn", "error"],
    default: "info",
    description: "Log level for the controller.",
    required: false,
    type: "string",
  } as Options,
};

export const enableMetrics = {
  "enable-metrics": {
    default: true,
    description: "Enable Prometheus metrics server",
    required: false,
    type: "boolean",
  } as Options,
};

export const metricsPort = {
  "metrics-port": {
    default: 9090,
    description: "Port for the Prometheus metrics server",
    required: false,
    type: "number",
  } as Options,
};
