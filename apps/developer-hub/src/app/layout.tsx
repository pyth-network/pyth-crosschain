import type { ReactNode } from "react";

import { Root } from "../components/Root";

export { metadata, viewport } from "../metadata";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <Root>{children}</Root>;
}
