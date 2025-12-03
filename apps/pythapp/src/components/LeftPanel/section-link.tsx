import type { Icon } from "@phosphor-icons/react";
import { Link } from "@pythnetwork/component-library/Link";
import type { ReactNode } from "react";

import classes from "./index.module.scss";

type SectionLinkProps = {
  /**
   * will display this icon on the left-most side
   * of the nav panel, before the title
   */
  icon: Icon;

  /**
   * unique identifier that will be used in an HTML data-sectionid attribute.
   * this is required to improve CSS specificity without needing a bunch
   * of !important style overrides
   */
  id: string;

  /**
   * if specified, will display this on the right-most side
   * of nav panel, after the link title
   */
  suffix?: ReactNode;

  /**
   * primary text to display as part of the nav link
   */
  title: ReactNode;
};

/**
 * represents a clickable link in the left nav,
 * with some optional metadata and iconography
 */
export function SectionLink({
  icon: Icon,
  id,
  suffix,
  title,
}: SectionLinkProps) {
  return (
    <Link className={classes.sectionLink ?? ""} data-sectionid={id} href="/">
      <Icon className={classes.sectionLinkIcon} />
      <span className={classes.sectionLinkContents}>
        {title}
        {suffix && <span className={classes.sectionLinkContentsSuffix}></span>}
      </span>
    </Link>
  );
}
