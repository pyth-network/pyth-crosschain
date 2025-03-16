export type Parameter<Name extends string> = {
  name: Name;
  type: ParameterType;
  description: string;
};

export enum ParameterType {
  PriceFeedId,
  PriceFeedIdArray,
  HexArray,
  Hex,
  Int,
  IntArray,
}

export const TRANSFORMS: Partial<
  Record<ParameterType, (value: string) => unknown>
> = {
  [ParameterType.PriceFeedIdArray]: (value) => [value],
  [ParameterType.HexArray]: (value) => [value],
  [ParameterType.IntArray]: (value) => [value],
};

export const PLACEHOLDERS: Record<ParameterType, string> = {
  [ParameterType.PriceFeedId]:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  [ParameterType.PriceFeedIdArray]:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  [ParameterType.Hex]:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  [ParameterType.HexArray]:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  [ParameterType.Int]: "60",
  [ParameterType.IntArray]: "60",
};

export const getValidationError = <Name extends string>(
  parameter: Parameter<Name>,
  value: string,
): string | undefined => {
  const messages = VALIDATIONS[parameter.type]
    .map((validation) => validation(value))
    .filter((message) => message !== undefined);
  return messages.length === 0 ? undefined : messages.join(", ");
};

export const isValid = <Name extends string>(
  parameter: Parameter<Name>,
  value: string,
): boolean =>
  VALIDATIONS[parameter.type].every(
    (validation) => validation(value) === undefined,
  );

const validateHex = (value: string) =>
  HEX_REGEX.test(value)
    ? undefined
    : 'Please enter a hexadecimal string prefixed with 0x, for example "0xa19f"';

const validateInt = (value: string) =>
  Number.parseInt(value, 10).toString() === value
    ? undefined
    : "Please enter a valid integer";

const VALIDATIONS: Record<
  ParameterType,
  ((value: string) => string | undefined)[]
> = {
  [ParameterType.PriceFeedId]: [validateHex],
  [ParameterType.PriceFeedIdArray]: [validateHex],
  [ParameterType.Hex]: [validateHex],
  [ParameterType.HexArray]: [validateHex],
  [ParameterType.Int]: [validateInt],
  [ParameterType.IntArray]: [validateInt],
};

const HEX_REGEX = new RegExp("^(0|0x[0-9A-Fa-f]*)$");
