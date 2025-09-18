import { createOpenAPI } from "fumadocs-openapi/server";

export const fortunaOpenApiJson =
  "https://fortuna.dourolabs.app/docs/openapi.json";

export const openapi = createOpenAPI({
  input: [fortunaOpenApiJson],
});
