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

export const cooldownDuration = {
  "cooldown-duration": {
    description:
      "The amount of time (in seconds) to wait between pushing price updates. " +
      "This value should be greater than the block time of the network, so this program confirms " +
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
