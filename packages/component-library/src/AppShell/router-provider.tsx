"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { RouterProvider as ReactAriaRouterProvider } from "react-aria";

declare module "react-aria" {
  type RouterConfig = {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  };
}

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
