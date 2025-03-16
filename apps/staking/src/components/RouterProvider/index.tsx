"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { RouterProvider as ReactAriaRouterProvider } from "react-aria-components";

export const RouterProvider = (
  props: Omit<ComponentProps<typeof ReactAriaRouterProvider>, "navigate">,
) => {
  const router = useRouter();
  const navigate = useCallback(
    (...params: Parameters<typeof router.push>) => {
      router.push(...params);
    },
    [router],
  );

  return <ReactAriaRouterProvider navigate={navigate} {...props} />;
};
