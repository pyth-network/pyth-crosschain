import type { ComponentType, ReactNode } from "react";

type ComposeProvidersProps = {
  providers: ComponentType<{ children: ReactNode }>[];
  children?: ReactNode | ReactNode[];
};

export const ComposeProviders = ({
  providers,
  children,
}: ComposeProvidersProps) => {
  let node = children;
  for (const Provider of providers) {
    node = <Provider>{node}</Provider>;
  }
  return node;
};
