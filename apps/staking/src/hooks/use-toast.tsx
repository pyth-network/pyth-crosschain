"use client";

import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";

export enum ToastType {
  Success,
  Error,
}
const Toast = {
  ErrorToast: (error: unknown) => ({ error, type: ToastType.Error as const }),
  Success: (message: ReactNode) => ({
    message,
    type: ToastType.Success as const,
  }),
};
export type Toast = ReturnType<(typeof Toast)[keyof typeof Toast]>;

type ToastState = {
  queue: ToastQueue<Toast>;
  success: (message: ReactNode) => void;
  error: (error: unknown) => void;
};

const ToastContext = createContext<undefined | ToastState>(undefined);

type ToastContextProps = Omit<
  ComponentProps<typeof ToastContext.Provider>,
  "value"
>;

export const ToastProvider = (props: ToastContextProps) => {
  const queue = useMemo(
    () =>
      new ToastQueue<Toast>({
        maxVisibleToasts: 3,
      }),
    [],
  );

  const success = useCallback(
    (message: ReactNode) => queue.add(Toast.Success(message)),
    [queue],
  );
  const error = useCallback(
    (error: unknown) => queue.add(Toast.ErrorToast(error)),
    [queue],
  );

  return <ToastContext.Provider value={{ error, queue, success }} {...props} />;
};

export const useToast = () => {
  const toast = useContext(ToastContext);
  if (toast) {
    return toast;
  } else {
    throw new NotInitializedError();
  }
};

class NotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a `ToastProvider`!");
  }
}
