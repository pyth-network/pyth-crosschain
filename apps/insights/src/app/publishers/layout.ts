import type { Metadata } from "next";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => children;
export default Layout;
// export { ZoomLayoutTransition as default } from "../../components/ZoomLayoutTransition";

export const metadata: Metadata = {
  title: {
    default: "Publishers",
    template: "%s | Publishers | Pyth Network Insights",
  },
  description: "Explore publishers who contribute to the Pyth network.",
};
