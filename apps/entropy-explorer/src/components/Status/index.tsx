import { Status as StatusImpl } from "@pythnetwork/component-library/Status";
import type { ComponentProps } from "react";

import { Status as StatusType } from "../../requests";

type Props = Omit<ComponentProps<typeof StatusImpl>, "variant" | "style"> & {
  status: StatusType;
  prefix?: string | undefined;
};

export const Status = ({ status, prefix, ...props }: Props) => {
  switch (status) {
    case StatusType.Complete: {
      return (
        <StatusImpl variant="success" {...props}>
          {prefix}COMPLETE
        </StatusImpl>
      );
    }
    case StatusType.CallbackError: {
      return (
        <StatusImpl variant="error" {...props}>
          {prefix}ERROR
        </StatusImpl>
      );
    }
    case StatusType.Pending: {
      return (
        <StatusImpl variant="disabled" style="outline" {...props}>
          {prefix}PENDING
        </StatusImpl>
      );
    }
  }
};
