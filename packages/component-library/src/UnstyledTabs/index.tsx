/**
 * The react-aria components aren't marked as "use client" so it's a bit
 * obnoxious to use them; this file just adds a client boundary and re-exports
 * the react-aria components to avoid that problem.
 */

"use client";

export {
  Tab as UnstyledTab,
  TabList as UnstyledTabList,
  TabPanel as UnstyledTabPanel,
  Tabs as UnstyledTabs,
} from "react-aria-components";
