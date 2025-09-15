import { createOpenAPI } from 'fumadocs-openapi/server';


export const fortunaOpenApiUrl = 'https://fortuna.dourolabs.app/docs/openapi.json';
export const fortunaStagingOpenApiUrl = 'https://fortuna-staging.dourolabs.app/docs/openapi.json';

export const openapi = createOpenAPI({
  input: [fortunaOpenApiUrl, fortunaStagingOpenApiUrl],
});