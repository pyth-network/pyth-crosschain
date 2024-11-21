import clsx from "clsx";
import {
  type LabelProps,
  type TextProps,
  type RadioGroupProps as BaseRadioGroupProps,
  RadioGroup as BaseRadioGroup,
  Label,
  Text,
} from "react-aria-components";

type CheckboxGroupProps = BaseRadioGroupProps & {
  label: LabelProps["children"];
  description?: TextProps["children"] | undefined;
};

export const RadioGroup = ({
  children,
  className,
  label,
  description,
  ...props
}: CheckboxGroupProps) => (
  <BaseRadioGroup className={clsx("group/radio-group", className)} {...props}>
    {(args) => (
      <>
        <Label className="mb-1 text-sm font-medium">{label}</Label>
        <div className="flex group-data-[orientation=horizontal]/radio-group:flex-row group-data-[orientation=vertical]/radio-group:flex-col group-data-[orientation=horizontal]/radio-group:gap-6">
          {typeof children === "function" ? children(args) : children}
        </div>
        {description && description !== "" && (
          <Text slot="description" className="text-xs font-light">
            {description}
          </Text>
        )}
      </>
    )}
  </BaseRadioGroup>
);
