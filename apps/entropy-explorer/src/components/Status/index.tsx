import { Status as StatusImpl } from "@pythnetwork/component-library/Status";
import type { ComponentProps } from "react";

import { Status as StatusType } from "../../requests";

type Props = Omit<ComponentProps<typeof StatusImpl>, "variant" | "style"> & {
  status: StatusType;
};

export const Status = ({ status, ...props }: Props) => {
  switch (status) {
    case StatusType.Complete: {
      return (
        <StatusImpl variant="success" {...props}>
          COMPLETE
        </StatusImpl>
      );
    }
    case StatusType.Failed: {
      return (
        <StatusImpl variant="error" {...props}>
          REVEAL ERROR
        </StatusImpl>
      );
    }
    case StatusType.CallbackError: {
      return (
        <StatusImpl variant="warning" {...props}>
          CALLBACK FAILED
        </StatusImpl>
      );
    }
    case StatusType.Pending: {
      return (
        <StatusImpl variant="disabled" style="outline" {...props}>
          PENDING
        </StatusImpl>
      );
    }
  }
};
