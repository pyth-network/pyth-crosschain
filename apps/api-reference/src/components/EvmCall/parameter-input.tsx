import {
  type ReactNode,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";

import { Input } from "../Input";

type ParameterProps<
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
> = {
  spec: Parameter<ParameterName>;
  value: string | undefined;
  setParamValues: Dispatch<SetStateAction<Partial<Parameters>>>;
};

export type Parameter<Name extends string> = {
  name: Name;
  type: ParameterType;
  description: ReactNode;
};

export enum ParameterType {
  Hex,
  Int,
}

export const ParameterInput = <
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
>({
  spec,
  value,
  setParamValues,
}: ParameterProps<ParameterName, Parameters>) => {
  const { validationError, internalValue, onChange } = useParameterInput(
    spec,
    value,
    setParamValues,
  );

  return (
    <Input
      validationError={validationError}
      label={spec.name}
      description={spec.description}
      placeholder={PLACEHOLDERS[spec.type]}
      required={true}
      value={internalValue}
      onChange={onChange}
    />
  );
};

const useParameterInput = <
  ParameterName extends string,
  Parameters extends Record<ParameterName, string>,
>(
  spec: Parameter<ParameterName>,
  value: string | undefined,
  setParamValues: Dispatch<SetStateAction<Partial<Parameters>>>,
) => {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const validationError = useMemo(
    () =>
      internalValue ? getValidationError(internalValue, spec.type) : undefined,
    [internalValue, spec.type],
  );
  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInternalValue(value);
      setParamValues((paramValues) => ({
        ...paramValues,
        [spec.name]:
          value === "" || !isValid(value, spec.type) ? undefined : value,
      }));
    },
    [setParamValues, spec.name, spec.type],
  );

  useEffect(() => {
    if (value) {
      setInternalValue(value);
    }
  }, [value]);

  return { internalValue, validationError, onChange };
};

const PLACEHOLDERS: Record<ParameterType, string> = {
  [ParameterType.Hex]:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  [ParameterType.Int]: "60",
};

const VALIDATION_ERRORS: Record<ParameterType, string> = {
  [ParameterType.Hex]:
    'Please enter a hexadecimal string prefixed with 0x, for example "0xa19f"',
  [ParameterType.Int]: "Please enter a valid integer",
};

const HEX_REGEX = new RegExp("^(0|0x[0-9A-Fa-f]*)$");

const getValidationError = (
  value: string,
  format: ParameterType,
): string | undefined =>
  isValid(value, format) ? undefined : VALIDATION_ERRORS[format];

const isValid = (value: string, format: ParameterType): boolean => {
  switch (format) {
    case ParameterType.Hex: {
      return HEX_REGEX.test(value);
    }
    case ParameterType.Int: {
      return Number.parseInt(value, 10).toString() === value;
    }
  }
};
