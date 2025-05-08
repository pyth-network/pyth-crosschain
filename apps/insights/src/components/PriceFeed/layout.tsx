import type { ReactNode } from "react";

import styles from "./layout.module.scss";
import { TabPanel, TabRoot, Tabs } from "../Tabs";

type Props = {
  header: ReactNode;
  feedCountBadge: ReactNode;
  children: ReactNode;
};

export const PriceFeedLayout = ({
  children,
  feedCountBadge,
  header,
}: Props) => (
  <div className={styles.priceFeedLayout}>
    {header}
    <TabRoot>
      <Tabs
        label="Price Feed Navigation"
        items={[
          { id: "(main)", segment: undefined, children: "Chart" },
          {
            segment: "publishers",
            children: (
              <div className={styles.priceComponentsTabLabel}>
                <span>Publishers</span>
                {feedCountBadge}
              </div>
            ),
          },
        ]}
      />
      <TabPanel className={styles.body ?? ""}>{children}</TabPanel>
    </TabRoot>
  </div>
);
