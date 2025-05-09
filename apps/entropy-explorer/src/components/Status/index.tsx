import { Status as StatusImpl } from "@pythnetwork/component-library/Status";

import type { getRequests } from "../../get-requests";

type Props = {
  request: Awaited<ReturnType<typeof getRequests>>[number];
  abbreviated?: boolean | undefined;
};

export const Status = ({ request, abbreviated }: Props) => {
  const prefix = abbreviated ? "" : "CALLBACK ";

  if (request.hasCallbackCompleted) {
    return request.callbackResult.failed ? (
      <StatusImpl variant="error">{prefix}FAILED</StatusImpl>
    ) : (
      <StatusImpl variant="success">{prefix}SUCCESS</StatusImpl>
    );
  } else {
    return (
      <StatusImpl variant="disabled" style="outline">
        {prefix}PENDING
      </StatusImpl>
    );
  }
};
