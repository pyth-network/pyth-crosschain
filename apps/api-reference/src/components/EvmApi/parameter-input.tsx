import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  Fragment,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import Markdown from "react-markdown";

import {
  type Parameter,
  PLACEHOLDERS,
  isValid,
  getValidationError,
} from "./parameter";
import { MARKDOWN_COMPONENTS } from "../../markdown-components";
import { Input } from "../Input";

type ParameterProps<ParameterName extends string> = {
  spec: Parameter<ParameterName>;
  value: string | undefined;
  setParamValues: Dispatch<
    SetStateAction<Partial<Record<ParameterName, string>>>
  >;
};

export const ParameterInput = <ParameterName extends string>({
  spec,
  value,
  setParamValues,
}: ParameterProps<ParameterName>) => {
  const { validationError, internalValue, onChange } = useParameterInput(
    spec,
    value,
    setParamValues,
  );

  return (
    <Input
      validationError={validationError}
      label={spec.name}
      description={
        <Markdown
          components={{
            ...MARKDOWN_COMPONENTS,
            p: ({ children }) => <Fragment>{children}</Fragment>,
          }}
        >
          {spec.description}
        </Markdown>
      }
      placeholder={PLACEHOLDERS[spec.type]}
      required={true}
      value={internalValue}
      onChange={onChange}
    />
  );
};

const useParameterInput = <ParameterName extends string>(
  spec: Parameter<ParameterName>,
  value: string | undefined,
  setParamValues: Dispatch<
    SetStateAction<Partial<Record<ParameterName, string>>>
  >,
) => {
  const [internalValue, setInternalValue] = useState(value ?? "");
  const validationError = useMemo(
    () => (internalValue ? getValidationError(spec, internalValue) : undefined),
    [internalValue, spec],
  );
  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInternalValue(value);
      setParamValues((paramValues) => ({
        ...paramValues,
        [spec.name]: value === "" || !isValid(spec, value) ? undefined : value,
      }));
    },
    [setParamValues, spec],
  );

  useEffect(() => {
    if (value) {
      setInternalValue(value);
    }
  }, [value]);

  return { internalValue, validationError, onChange };
};
