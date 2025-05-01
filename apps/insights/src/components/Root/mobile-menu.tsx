import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { Button } from "@pythnetwork/component-library/Button";

import styles from "./mobile-menu.module.scss";
import { SupportDrawer } from "./support-drawer";
import { ThemeSwitch } from "./theme-switch";

type Props = {
  className?: string | undefined;
};

export const MobileMenu = ({ className }: Props) => (
  <Button
    className={className ?? ""}
    beforeIcon={List}
    variant="ghost"
    size="sm"
    rounded
    hideText
    drawer={{
      hideHeading: true,
      title: "Menu",
      contents: <MobileMenuContents />,
    }}
  >
    Menu
  </Button>
);

const MobileMenuContents = () => (
  <div className={styles.mobileMenu}>
    <div className={styles.buttons}>
      <Button
        variant="ghost"
        size="md"
        rounded
        beforeIcon={Lifebuoy}
        drawer={SupportDrawer}
      >
        Support
      </Button>
      <Button
        href="https://docs.pyth.network"
        size="md"
        rounded
        target="_blank"
      >
        Dev Docs
      </Button>
    </div>
    <div className={styles.theme}>
      <span className={styles.themeLabel}>Theme</span>
      <ThemeSwitch />
    </div>
  </div>
);
