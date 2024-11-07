import { useMemo, type HTMLProps } from "react";
import { useDateFormatter, type DateFormatterOptions } from "react-aria";

type Props = Omit<HTMLProps<HTMLSpanElement>, "children"> & {
  children: Date;
  options?: DateFormatterOptions | undefined | "time";
};

export const Date = ({ children, options, ...props }: Props) => {
  const formatter = useDateFormatter(
    options === "time"
      ? {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }
      : options,
  );
  const value = useMemo(
    () => formatter.format(children),
    [formatter, children],
  );

  return <span {...props}>{value}</span>;
};
