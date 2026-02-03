import type { ButtonLinkProps } from "@pythnetwork/component-library/v2";
import { Badge, ButtonLink } from "@pythnetwork/component-library/v2";

import { classes } from "./ComingSoonNavLink.styles";

export function ComingSoonNavLink({
  children,
  ...rest
}: Omit<ButtonLinkProps, "disabled">) {
  return (
    <ButtonLink {...rest} disabled>
      <span className={classes.root} data-pizzapasta>
        {children}
        <Badge size="xs" variant="neutral">
          COMING SOON
        </Badge>
      </span>
    </ButtonLink>
  );
}
