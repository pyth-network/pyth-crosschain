import type { ReactNode } from "react";
import "katex/dist/katex.css";

import { Root } from "../components/Root";

export { metadata, viewport } from "../metadata";

import "katex/dist/katex.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <Root>{children}</Root>;
}
