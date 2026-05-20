import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { MigrationBanner } from "../../components/MigrationBanner";
import { baseOptions } from "../../config/layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <MigrationBanner />
      <HomeLayout {...baseOptions}>{children}</HomeLayout>
    </>
  );
}
