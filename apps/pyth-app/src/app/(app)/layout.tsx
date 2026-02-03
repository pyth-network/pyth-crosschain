import type { PropsWithChildren } from "react";

import { PythAppLayout } from "../../components/Layout";

export default function AppLayout({ children }: Readonly<PropsWithChildren>) {
  return <PythAppLayout>{children}</PythAppLayout>;
}
