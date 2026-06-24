import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { ChangelogBar } from "../../components/ChangelogBar";
import { MigrationBanner } from "../../components/MigrationBanner";
import { baseOptions } from "../../config/layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <MigrationBanner />
      <ChangelogBar />
      <HomeLayout {...baseOptions}>{children}</HomeLayout>
    </>
  );
}
