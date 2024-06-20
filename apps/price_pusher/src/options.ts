import { Options } from "yargs";

export const priceServiceEndpoint = {
  "price-service-endpoint": {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  } as Options,
};

export const pythContractAddress = {
  "pyth-contract-address": {
    description:
      "Pyth contract address. Provide the network name on which Pyth is deployed " +
      "or the Pyth contract address if you use a local network.",
    type: "string",
    required: true,
  } as Options,
};

export const priceConfigFile = {
  "price-config-file": {
    description: "Path to price configuration YAML file.",
    type: "string",
    required: true,
  } as Options,
};

export const pollingFrequency = {
  "polling-frequency": {
    description:
      "The frequency to poll price info data from the network if the RPC is not a websocket.",
    type: "number",
    required: false,
    default: 5,
  } as Options,
};

export const pushingFrequency = {
  "pushing-frequency": {
    description:
      "The frequency to push prices to the RPC. " +
      "It is better that the value be greater than the block time of the network, so this program confirms " +
      "it is updated and does not push it twice.",
    type: "number",
    required: false,
    default: 10,
  } as Options,
};

export const mnemonicFile = {
  "mnemonic-file": {
    description: "Path to payer mnemonic (private key) file.",
    type: "string",
    required: true,
  } as Options,
};

export const logLevel = {
  "log-level": {
    description: "Log level",
    type: "string",
    required: false,
    default: "info",
    choices: ["trace", "debug", "info", "warn", "error"],
  } as Options,
};

export const priceServiceConnectionLogLevel = {
  "price-service-connection-log-level": {
    description: "Log level for the price service connection.",
    type: "string",
    required: false,
    default: "warn",
    choices: ["trace", "debug", "info", "warn", "error"],
  } as Options,
};

export const controllerLogLevel = {
  "controller-log-level": {
    description: "Log level for the controller.",
    type: "string",
    required: false,
    default: "info",
    choices: ["trace", "debug", "info", "warn", "error"],
  } as Options,
};
