import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Switch as BaseSwitch } from "react-aria-components";

type Props = Omit<ComponentProps<typeof BaseSwitch>, "children"> & {
  preLabel?: ReactNode;
  postLabel?: ReactNode;
  size?: "small";
};

export const Switch = ({
  preLabel,
  postLabel,
  className,
  size,
  ...props
}: Props) => (
  <BaseSwitch
    className={clsx(
      "group flex cursor-pointer flex-row items-center gap-2",
      className,
    )}
    {...props}
  >
    {preLabel && <div className="whitespace-nowrap opacity-80">{preLabel}</div>}
    <div
      className={clsx(
        "flex-none rounded-full border border-neutral-400/50 bg-neutral-800/50 p-1 transition group-data-[selected]:border-pythpurple-600 group-data-[selected]:bg-pythpurple-600/10",
        size === "small" ? "h-6 w-10" : "h-8 w-16",
      )}
    >
      <div
        className={clsx(
          "aspect-square h-full rounded-full bg-neutral-400/50 transition group-data-[selected]:bg-pythpurple-600",
          size === "small"
            ? "group-data-[selected]:translate-x-4"
            : "group-data-[selected]:translate-x-8",
        )}
      />
    </div>
    {postLabel && (
      <div className="whitespace-nowrap opacity-80">{postLabel}</div>
    )}
  </BaseSwitch>
);
