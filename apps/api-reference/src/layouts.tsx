import type { ComponentProps, ReactNode } from "react";

import { EvmCall } from "./components/EvmCall";

export {
  Language as EvmLanguage,
  ParameterType as EvmParameterType,
} from "./components/EvmCall";

type Props = {
  children: ReactNode;
};

export const evmCall = (
  props: Omit<ComponentProps<typeof EvmCall>, "children">,
) => {
  const EvmCallLayout = ({ children }: Props) => (
    <EvmCall {...props}>{children}</EvmCall>
  );
  return EvmCallLayout;
};
