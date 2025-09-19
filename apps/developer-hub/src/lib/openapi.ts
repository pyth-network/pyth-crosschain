import { createOpenAPI } from "fumadocs-openapi/server";

export const products = {
  fortuna: {
    name: "fortuna",
    openApiUrl: "https://fortuna-staging.dourolabs.app/docs/openapi.json",
  },
};

export const openapi = createOpenAPI({
  input: Object.values(products).map((product) => product.openApiUrl),
});
