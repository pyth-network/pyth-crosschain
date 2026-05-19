import { Badge } from "@pythnetwork/component-library/Badge";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Badge>, "children"> & {
  children: string;
};

export const AssetClassBadge = ({ children, ...props }: Props) => (
  <Badge size="xs" style="outline" variant="neutral" {...props}>
    {children.toUpperCase()}
  </Badge>
);
