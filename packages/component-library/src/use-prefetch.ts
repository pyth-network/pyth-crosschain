/**
 * Currently, react-aria does not use the nextjs `Link` component, and instead
 * just uses [the
 * RouterProvider](https://react-spectrum.adobe.com/react-aria/routing.html#routerprovider)
 * to handle client-side routing.
 *
 * In most cases, this is fine.  However, one major downside is that this breaks
 * link preloading.  There is currently no way to re-enable link preloading
 * that's built into react-aria, see [this
 * ticket](https://github.com/adobe/react-spectrum/issues/5476).
 *
 * This hook simply extracts the preload behavior from [the nextjs Link
 * component](https://github.com/vercel/next.js/blob/canary/packages/next/src/client/link.tsx)
 * so that we can re-enable link preload on various react-aria linkable
 * elements.
 */

"use client";

import type { UrlObject } from "node:url";

import { useRerender } from "@react-hookz/web";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types.js";
import { useIntersection } from "next/dist/client/use-intersection.js";
import { useMergedRef } from "next/dist/client/use-merged-ref.js";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import { formatUrl } from "next/dist/shared/lib/router/utils/format-url.js";
import { isLocalURL } from "next/dist/shared/lib/router/utils/is-local-url.js";
import type { Ref } from "react";
import { useCallback, useMemo, useRef, useEffect, use } from "react";
import type { HoverEvent, PressEvent } from "react-aria";

type Options<T> = {
  href?: UrlObject | string | undefined;
  prefetch?: boolean | undefined;
  onHoverStart?: ((event: HoverEvent) => void) | undefined;
  onPressStart?: ((event: PressEvent) => void) | undefined;
  ref?: Ref<T | null> | undefined;
};

export const usePrefetch = <T extends Element>({
  href,
  prefetch,
  onHoverStart,
  onPressStart,
  ref,
}: Options<T>) => {
  const router = use(AppRouterContext);
  const rerender = useRerender();

  const resolvedHref = useMemo(
    () =>
      href === undefined || typeof href === "string" ? href : formatUrl(href),
    [href],
  );

  const previousHref = useRef<string>(resolvedHref);

  const [setIntersectionRef, isVisible, resetVisible] = useIntersection({
    rootMargin: "200px",
  });

  const setIntersectionWithResetRef = useCallback(
    (el: T) => {
      // Before the link getting observed, check if visible state need to be reset
      if (previousHref.current !== resolvedHref) {
        resetVisible();
        previousHref.current = resolvedHref;
      }

      setIntersectionRef(el);
      rerender();
    },
    [resolvedHref, resetVisible, setIntersectionRef, rerender],
  );

  // eslint-disable-next-line unicorn/no-null
  const setRef = useMergedRef(setIntersectionWithResetRef, ref ?? null);

  const doPrefetch = useCallback(
    (allowInDev?: boolean) => {
      if (
        resolvedHref === undefined ||
        prefetch === false ||
        // eslint-disable-next-line n/no-process-env
        (!allowInDev && process.env.NODE_ENV !== "production") ||
        !isLocalURL(resolvedHref)
      ) {
        return;
      }

      router?.prefetch(resolvedHref, {
        kind: prefetch === undefined ? PrefetchKind.AUTO : PrefetchKind.FULL,
      });
    },
    [prefetch, router, resolvedHref],
  );

  useEffect(() => {
    if (isVisible) {
      doPrefetch();
    }
  }, [isVisible, doPrefetch]);

  return {
    ref: ref === undefined ? setIntersectionWithResetRef : setRef,

    onHoverStart: useCallback(
      (e: HoverEvent) => {
        onHoverStart?.(e);
        doPrefetch();
      },
      [doPrefetch, onHoverStart],
    ),

    onPressStart: useCallback(
      (e: PressEvent) => {
        onPressStart?.(e);
        doPrefetch(true);
      },
      [doPrefetch, onPressStart],
    ),
  };
};
