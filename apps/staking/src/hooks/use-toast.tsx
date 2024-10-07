"use client";

import {
  type ToastState as BaseToastState,
  useToastState,
} from "@react-stately/toast";
import {
  type ComponentProps,
  type ReactNode,
  createContext,
  useContext,
  useCallback,
} from "react";

export enum ToastType {
  Success,
  Error,
}
const Toast = {
  Success: (message: ReactNode) => ({
    type: ToastType.Success as const,
    message,
  }),
  ErrorToast: (error: unknown) => ({ type: ToastType.Error as const, error }),
};
export type Toast = ReturnType<(typeof Toast)[keyof typeof Toast]>;

type ToastState = BaseToastState<Toast> & {
  success: (message: ReactNode) => void;
  error: (error: unknown) => void;
};

const ToastContext = createContext<undefined | ToastState>(undefined);

type ToastContextProps = Omit<
  ComponentProps<typeof ToastContext.Provider>,
  "value"
>;

export const ToastProvider = (props: ToastContextProps) => {
  const toast = useToastState<Toast>({
    maxVisibleToasts: 3,
    hasExitAnimation: true,
  });

  const success = useCallback(
    (message: ReactNode) => toast.add(Toast.Success(message)),
    [toast],
  );
  const error = useCallback(
    (error: unknown) => toast.add(Toast.ErrorToast(error)),
    [toast],
  );

  return (
    <ToastContext.Provider value={{ ...toast, success, error }} {...props} />
  );
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
