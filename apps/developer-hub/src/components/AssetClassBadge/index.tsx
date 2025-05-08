import { Badge } from "@pythnetwork/component-library/Badge";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Badge>, "children"> & {
  children: string;
};

export const AssetClassBadge = ({ children, ...props }: Props) => (
  <Badge variant="neutral" style="outline" size="xs" {...props}>
    {children.toUpperCase()}
  </Badge>
);
