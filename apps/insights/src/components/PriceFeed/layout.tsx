import type { ReactNode } from "react";
import { TabPanel, TabRoot, Tabs } from "../Tabs";
import styles from "./layout.module.scss";

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
        items={[
          { children: "Chart", id: "(main)", segment: undefined },
          {
            children: (
              <div className={styles.priceComponentsTabLabel}>
                <span>Publishers</span>
                {feedCountBadge}
              </div>
            ),
            segment: "publishers",
          },
        ]}
        label="Price Feed Navigation"
      />
      <TabPanel className={styles.body ?? ""}>{children}</TabPanel>
    </TabRoot>
  </div>
);
