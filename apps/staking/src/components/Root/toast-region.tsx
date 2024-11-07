"use client";

import { XMarkIcon } from "@heroicons/react/24/solid";
import {
  type AriaToastRegionProps,
  type AriaToastProps,
  useToastRegion,
  useToast as reactAriaUseToast,
} from "@react-aria/toast";
import clsx from "clsx";
import { useRef, useState } from "react";
import { Button } from "react-aria-components";

import {
  type Toast as ToastContentType,
  ToastType,
  useToast,
} from "../../hooks/use-toast";
import { ErrorMessage } from "../ErrorMessage";

export const ToastRegion = (props: AriaToastRegionProps) => {
  const state = useToast();
  const ref = useRef(null);
  const { regionProps } = useToastRegion(props, state, ref);

  return (
    <div
      {...regionProps}
      ref={ref}
      className="pointer-events-none fixed top-0 z-50 flex w-full flex-col items-center"
    >
      {state.visibleToasts.map((toast) => (
        <Toast key={toast.key} toast={toast} />
      ))}
    </div>
  );
};

const Toast = (props: AriaToastProps<ToastContentType>) => {
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const state = useToast();
  const ref = useRef(null);
  const { toastProps, contentProps, titleProps, closeButtonProps } =
    reactAriaUseToast(props, state, ref);

  return (
    <div
      {...toastProps}
      ref={ref}
      className="pt-4 data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:slide-in-from-top data-[exiting]:slide-out-to-top"
      {...((props.toast.animation === "entering" ||
        props.toast.animation === "queued") && { "data-entering": "" })}
      {...(props.toast.animation === "exiting" && { "data-exiting": "" })}
      onAnimationEnd={() => {
        if (
          props.toast.animation === "entering" ||
          props.toast.animation === "queued"
        ) {
          setIsTimerStarted(true);
        }
        if (props.toast.animation === "exiting") {
          state.remove(props.toast.key);
        }
      }}
    >
      <div className="pointer-events-auto w-96 bg-pythpurple-100 text-pythpurple-950">
        <div
          className={clsx(
            "h-1 w-full origin-left bg-green-500 transition-transform [transition-duration:5000ms] [transition-timing-function:linear]",
            {
              "scale-x-0": isTimerStarted,
              "bg-green-500": props.toast.content.type === ToastType.Success,
              "bg-red-500": props.toast.content.type === ToastType.Error,
            },
          )}
          onTransitionEnd={() => {
            state.close(props.toast.key);
          }}
        />
        <div className="flex flex-row items-start justify-between gap-8 px-4 py-2">
          <div {...contentProps}>
            <div {...titleProps}>
              <ToastContent>{props.toast.content}</ToastContent>
            </div>
          </div>
          <Button {...closeButtonProps}>
            <XMarkIcon className="mt-1 size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

type ToastContentProps = {
  children: ToastContentType;
};

const ToastContent = ({ children }: ToastContentProps) => {
  switch (children.type) {
    case ToastType.Error: {
      return <ErrorMessage error={children.error} />;
    }
    case ToastType.Success: {
      return children.message;
    }
  }
};
