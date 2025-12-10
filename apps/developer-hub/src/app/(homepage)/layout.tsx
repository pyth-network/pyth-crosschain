import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { baseOptions } from "../../config/layout.config";
import { PageFooter } from "../../components/Shared/footer";

export default function Layout({ children }: { children: ReactNode }) {
  return (<HomeLayout {...baseOptions}>
    <main>{children}</main>
    <PageFooter />
  </HomeLayout>);
}
