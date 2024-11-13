import type { ReactNode } from "react";

import { EpochSelect } from "./epoch-select";
import { H1 } from "../H1";
import { MaxWidth } from "../MaxWidth";

type Props = {
  children: ReactNode | undefined;
};

export const PriceFeedsLayout = ({ children }: Props) => (
  <MaxWidth>
    <div className="mb-12 flex flex-row items-center justify-between">
      <H1>Price Feeds</H1>
      <EpochSelect />
    </div>
    {children}
  </MaxWidth>
);
