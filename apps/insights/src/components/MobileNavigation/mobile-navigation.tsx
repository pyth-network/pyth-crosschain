import styles from "./mobile-navigation.module.scss";
import { MainNavTabs } from "../Root/tabs";
export const MobileNavigation = () => {
  return (
    <div className={styles.mobileNavigation}>
      <MainNavTabs />
    </div>
  );
};
