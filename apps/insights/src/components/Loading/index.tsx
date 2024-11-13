import { Skeleton } from "@pythnetwork/component-library/Skeleton";

import { H1 } from "../H1";
import { MaxWidth } from "../MaxWidth";

export const Loading = () => (
  <MaxWidth>
    <H1>
      <Skeleton className="w-60" />
    </H1>
  </MaxWidth>
);
