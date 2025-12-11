import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { PageFooter } from "../../components/Shared/footer";
import { baseOptions } from "../../config/layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout {...baseOptions}>
      <main>{children}</main>
      <PageFooter />
    </HomeLayout>
  );
}
