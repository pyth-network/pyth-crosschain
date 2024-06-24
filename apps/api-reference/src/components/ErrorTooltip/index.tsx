import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { ReactNode } from "react";

import { Tooltip } from "../Tooltip";

type Props = {
  children: ReactNode;
  className?: string | undefined;
};

export const ErrorTooltip = ({ className, children }: Props) => (
  <Tooltip arrow={{ width: 6, height: 10 }} gap={0} placement="top-end">
    <Tooltip.Trigger
      as={ExclamationCircleIcon}
      className={clsx("text-red-500 dark:text-red-700", className)}
    />
    <Tooltip.Content className="z-50 whitespace-pre-line rounded-md border border-red-500 bg-red-50 px-3 py-2 text-red-800 shadow-md dark:border-red-900 dark:bg-red-950 dark:text-red-200 dark:shadow-white/5">
      <Tooltip.Arrow className="fill-red-500 dark:fill-red-700" />
      <div className="max-w-40 text-xs">{children}</div>
    </Tooltip.Content>
  </Tooltip>
);
