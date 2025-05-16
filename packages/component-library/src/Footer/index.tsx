import clsx from "clsx";
import type { ComponentProps, ElementType } from "react";

import styles from "./index.module.scss";
import Wordmark from "./wordmark.svg";
import type { Props as ButtonProps } from "../Button/index.jsx";
import { Button } from "../Button/index.jsx";
import { SupportDrawer } from "../Header/index.jsx";
import { Link } from "../Link/index.jsx";
import { socialLinks } from "../social-links.jsx";

export const Footer = ({ className, ...props }: ComponentProps<"footer">) => (
  <footer className={clsx(styles.footer, className)} {...props}>
    <div className={styles.topContent}>
      <div className={styles.main}>
        <Link href="https://www.pyth.network" className={styles.logoLink ?? ""}>
          <Wordmark className={styles.logo} />
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.divider} />
        <div className={styles.help}>
          <Link drawer={SupportDrawer}>Help</Link>
          <Link href="https://docs.pyth.network" target="_blank">
            Documentation
          </Link>
        </div>
      </div>
      <div className={styles.socialLinks}>
        {socialLinks.map(({ name, ...props }) => (
          <SocialLink {...props} key={name}>
            {name}
          </SocialLink>
        ))}
      </div>
    </div>
    <div className={styles.trademarkDisclaimer}>
      <div className={styles.trademarkDisclaimerContent}>
        <h3 className={styles.trademarkDisclaimerHeader}>
          TRADEMARK DISCLAIMER
        </h3>
        <p className={styles.trademarkDisclaimerBody}>
          This website may display ticker symbols, product names, and other
          identifiers that are trademarks, service marks or trade names of third
          parties. Such display is for informational purposes only and does not
          constitute any claim of ownership thereof by Pyth Data Association or
          any of its subsidiaries and other affiliates (collectively,
          &quot;Association&quot;) or any sponsorship or endorsement by
          Association of any associated products or services, and should not be
          construed as indicating any affiliation, sponsorship or other
          connection between Association and the third-party owners of such
          identifiers. Any such third-party identifiers associated with
          financial data are made solely to identify the relevant financial
          products for which price data is made available via the website. All
          trademarks, service marks, logos, product names, trade names and
          company names mentioned on the website are the property of their
          respective owners and are protected by trademark and other
          intellectual property laws. Association makes no representations or
          warranties with respect to any such identifiers or any data or other
          information associated therewith and reserves the right to modify or
          remove any such displays at its discretion.
        </p>
      </div>
    </div>
    <div className={styles.bottomContent}>
      <small className={styles.copyright}>© 2025 Pyth Data Association</small>
      <div className={styles.legal}>
        <Link href="https://www.pyth.network/privacy-policy" target="_blank">
          Privacy Policy
        </Link>
        <Link href="https://www.pyth.network/terms-of-use" target="_blank">
          Terms of Use
        </Link>
        <Link
          href="https://www.pyth.network/trademark-disclaimer"
          target="_blank"
        >
          Trademark Disclaimer
        </Link>
      </div>
    </div>
  </footer>
);

type SocialLinkProps<T extends ElementType> = Omit<
  ButtonProps<T>,
  "target" | "variant" | "size" | "beforeIcon" | "hideText"
> & {
  icon: ComponentProps<typeof Button>["beforeIcon"];
};

const SocialLink = <T extends ElementType>({
  icon,
  ...props
}: SocialLinkProps<T>) => (
  <Button
    target="_blank"
    variant="ghost"
    size="sm"
    beforeIcon={icon}
    hideText
    {...props}
  />
);
