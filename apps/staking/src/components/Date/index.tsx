import type { HTMLProps } from "react";
import { useMemo } from "react";
import type { DateFormatterOptions } from "react-aria";
import { useDateFormatter } from "react-aria";

type Props = Omit<HTMLProps<HTMLSpanElement>, "children"> & {
  children: Date;
  options?: DateFormatterOptions | undefined | "time";
};

// biome-ignore lint/suspicious/noShadowRestrictedNames: Date component intentionally shadows global Date
export const Date = ({ children, options, ...props }: Props) => {
  const formatter = useDateFormatter(
    options === "time"
      ? {
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          month: "numeric",
          second: "numeric",
          year: "numeric",
        }
      : options,
  );
  const value = useMemo(
    () => formatter.format(children),
    [formatter, children],
  );

  return <span {...props}>{value}</span>;
};
