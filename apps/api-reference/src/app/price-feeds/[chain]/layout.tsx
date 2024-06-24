import type { ReactNode } from "react";

import { EvmLayout } from "../../../components/EvmLayout";

type Props = {
  params: {
    chain: string;
  };
  children: ReactNode;
};

const Layout = ({ params, children }: Props) => {
  switch (params.chain) {
    case "evm": {
      return <EvmLayout>{children}</EvmLayout>;
    }
    default: {
      return children;
    }
  }
};
export default Layout;
