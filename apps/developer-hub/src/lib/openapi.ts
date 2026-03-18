import { createOpenAPI } from "fumadocs-openapi/server";

export const products = {
  fortuna: {
    name: "fortuna",
    openApiUrl: "https://fortuna-staging.dourolabs.app/docs/openapi.json",
    product: "entropy",
  },
  hermes: {
    name: "hermes",
    openApiUrl: "https://hermes.pyth.network/docs/openapi.json",
    product: "pyth-core",
  },
};

export const openapi = createOpenAPI({
  input: Object.values(products).map((product) => product.openApiUrl),
});
