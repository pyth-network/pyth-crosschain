import { type ZodSchema, type ZodTypeDef, z } from "zod";

export const singletonArray = <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
) =>
  z
    .array(schema)
    .length(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .transform((value) => value[0]!);

export const optionalSingletonArray = <Output, Def extends ZodTypeDef, Input>(
  schema: ZodSchema<Output, Def, Input>,
) =>
  z
    .array(schema)
    .max(1)
    .transform((value) => value[0]);
