import type { NavigationButtonLinkProps } from "@pythnetwork/component-library/v2";
import { Badge, NavigationButtonLink } from "@pythnetwork/component-library/v2";

import { classes } from "./ComingSoonNavLink.styles";

export function ComingSoonNavLink({
  children,
  ...rest
}: Omit<NavigationButtonLinkProps, "disabled">) {
  return (
    <NavigationButtonLink {...rest} disabled>
      <span className={classes.root}>
        {children}
        <Badge size="xs" variant="neutral">
          COMING SOON
        </Badge>
      </span>
    </NavigationButtonLink>
  );
}
