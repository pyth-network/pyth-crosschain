import type { Metadata } from "next";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => children;
export default Layout;
// export { ZoomLayoutTransition as default } from "../../components/ZoomLayoutTransition";

export const metadata: Metadata = {
  title: {
    default: "Price Feeds",
    template: "%s | Price Feeds | Pyth Network Insights",
  },
  description: "Explore market data on the Pyth network.",
};
