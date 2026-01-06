import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";

import { baseOptions } from "../../config/layout.config";

export default function PlaygroundLayout({ children }: PlaygroundLayoutProps) {
  return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
}

type PlaygroundLayoutProps = {
  children: ReactNode;
};

