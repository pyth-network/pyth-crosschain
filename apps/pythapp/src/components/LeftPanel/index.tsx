import { Key, Wallet } from "@phosphor-icons/react/dist/ssr";

import classes from "./index.module.scss";
import { SectionLink } from "./section-link";

/**
 * the main app left-hand navigation panel and drawer
 */
export function LeftPanel() {
  return (
    <nav className={classes.root}>
      <SectionLink icon={Key} id="api-keys" title="API keys" />
      <SectionLink
        icon={Wallet}
        id="pyth-subcription"
        title="pyth subscription"
      />
    </nav>
  );
}
