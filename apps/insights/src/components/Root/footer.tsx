import {
  type Props as ButtonProps,
  Button,
} from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";
import type { ComponentProps, ElementType } from "react";

import styles from "./footer.module.scss";
import { socialLinks } from "./social-links";
import { SupportDrawer } from "./support-drawer";
import Wordmark from "./wordmark.svg";

export const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.topContent}>
      <div className={styles.left}>
        <Link href="https://www.pyth.network" className={styles.logoLink ?? ""}>
          <Wordmark className={styles.logo} />
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.divider} />
        <div className={styles.help}>
          <SupportDrawer>
            <Link>Help</Link>
          </SupportDrawer>
          <Link href="https://docs.pyth.network" target="_blank">
            Documentation
          </Link>
        </div>
      </div>
      <div className={styles.right}>
        {socialLinks.map(({ name, ...props }) => (
          <SocialLink {...props} key={name}>
            {name}
          </SocialLink>
        ))}
      </div>
    </div>
    <div className={styles.bottomContent}>
      <small className={styles.copyright}>© 2024 Pyth Data Association</small>
      <div className={styles.legal}>
        <Link href="https://www.pyth.network/privacy-policy" target="_blank">
          Privacy Policy
        </Link>
        <Link href="https://www.pyth.network/terms-of-use" target="_blank">
          Terms of Use
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
