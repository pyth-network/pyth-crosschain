"use client";

import { Drawer } from "@pythnetwork/component-library/Drawer";
import {
  useSelectedLayoutSegment,
  usePathname,
  useRouter,
} from "next/navigation";
import { type ReactNode, useMemo, useCallback } from "react";

type Props = {
  children: ReactNode;
};

export const PriceComponentDrawer = ({ children }: Props) => {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const prevUrl = useMemo(
    () =>
      segment ? pathname.replace(new RegExp(`/${segment}$`), "") : pathname,
    [pathname, segment],
  );
  const router = useRouter();

  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        router.push(prevUrl);
      }
    },
    [router, prevUrl],
  );

  return (
    <Drawer
      title="Hello!"
      closeHref={prevUrl}
      onOpenChange={onOpenChange}
      isOpen={segment !== null}
    >
      {children}
    </Drawer>
  );
};
