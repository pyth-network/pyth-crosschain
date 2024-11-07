import clsx from "clsx";
import {
  type LabelProps,
  type TextProps,
  type CheckboxGroupProps as BaseCheckboxGroupProps,
  CheckboxGroup as BaseCheckboxGroup,
  Label,
  Text,
} from "react-aria-components";

export const ORIENTATIONS = ["vertical", "horizontal"] as const;

type CheckboxGroupProps = BaseCheckboxGroupProps & {
  label: LabelProps["children"];
  description?: TextProps["children"] | undefined;
  orientation?: (typeof ORIENTATIONS)[number] | undefined;
};

export const CheckboxGroup = ({
  children,
  className,
  label,
  description,
  orientation = "vertical",
  ...props
}: CheckboxGroupProps) => (
  <BaseCheckboxGroup
    data-orientation={orientation}
    className={clsx("group/checkbox-group", className)}
    {...props}
  >
    {(args) => (
      <>
        <Label className="mb-1 text-sm font-medium">{label}</Label>
        <div className="flex group-data-[orientation=horizontal]/checkbox-group:flex-row group-data-[orientation=vertical]/checkbox-group:flex-col group-data-[orientation=horizontal]/checkbox-group:gap-6">
          {typeof children === "function" ? children(args) : children}
        </div>
        {description && description !== "" && (
          <Text slot="description" className="text-xs font-light">
            {description}
          </Text>
        )}
      </>
    )}
  </BaseCheckboxGroup>
);
