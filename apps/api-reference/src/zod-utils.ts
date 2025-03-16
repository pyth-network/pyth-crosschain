import type { ZodSchema, ZodTypeDef } from "zod";
import { z } from "zod";

export const singletonArray = <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
) =>
  z
    .array(schema)
    .length(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .transform((value) => value[0]!);

export const safeFetch = async <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
  ...fetchArgs: Parameters<typeof fetch>
) => {
  const response = await fetch(...fetchArgs);
  const json: unknown = await response.json();
  return schema.parseAsync(json);
};
