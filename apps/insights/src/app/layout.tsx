import { SimpleStyleProvider } from "@pythnetwork/component-library/styles";
import type { PropsWithChildren } from "react";

import { Root } from "../components/Root";
export { metadata, viewport } from "../metadata";

export default function DefaultLayout({ children }: PropsWithChildren) {
  return (
    <SimpleStyleProvider>
      <Root>{children}</Root>
    </SimpleStyleProvider>
  );
}
