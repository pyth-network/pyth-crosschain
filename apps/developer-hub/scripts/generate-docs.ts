import { generateFiles } from 'fumadocs-openapi';

  import { openapi } from '../src/lib/openapi';

// const schemas = await openapi.getSchemas();

// const fortunaSchema = schemas[fortunaOpenApiUrl];
// const fortunaStagingSchema = schemas[fortunaStagingOpenApiUrl];

void generateFiles({
  per: 'operation',
  groupBy: 'route',
  input: openapi,
  output: './content/docs/openapi/(generated)',
  includeDescription: true,
  addGeneratedComment: true,
});