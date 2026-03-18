"use client";

import { XMarkIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { ComponentProps } from "react";
import { useCallback, useState } from "react";
import {
  UNSTABLE_Toast as BaseToast,
  UNSTABLE_ToastContent as BaseToastContent,
  UNSTABLE_ToastRegion as BaseToastRegion,
  Button,
  Text,
} from "react-aria-components";

import type { Toast as ToastContentType } from "../../hooks/use-toast";
import { ToastType, useToast } from "../../hooks/use-toast";
import { ErrorMessage } from "../ErrorMessage";

const MotionBaseToast = motion(BaseToast);

export const ToastRegion = (
  props: Omit<
    ComponentProps<typeof BaseToastRegion<ToastContentType>>,
    "queue" | "children"
  >,
) => {
  const toast = useToast();

  return (
    <BaseToastRegion
      className="pointer-events-none fixed top-0 z-50 flex w-full flex-col-reverse items-center"
      queue={toast.queue}
      {...props}
    >
      {({ toast }) => <Toast key={toast.key} toast={toast} />}
    </BaseToastRegion>
  );
};

const Toast = (props: ComponentProps<typeof BaseToast<ToastContentType>>) => {
  const toast = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);
  const handlePresenceAnimationComplete = useCallback(
    (name: string) => {
      if (name === "exit") {
        toast.queue.close(props.toast.key);
      } else {
        setIsTimerStarted(true);
      }
    },
    [toast, props.toast],
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <MotionBaseToast
          animate={{ y: 0 }}
          className="pt-4"
          exit={{ transition: { duration: 0.1, ease: "linear" }, y: "-100%" }}
          initial={{ y: "-100%" }}
          onAnimationComplete={handlePresenceAnimationComplete}
          toast={props.toast}
        >
          <div className="pointer-events-auto w-96 bg-pythpurple-100 text-pythpurple-950">
            <div
              className={clsx(
                "h-1 w-full origin-left bg-green-500 transition-transform [transition-duration:5000ms] [transition-timing-function:linear]",
                {
                  "bg-green-500":
                    props.toast.content.type === ToastType.Success,
                  "bg-red-500": props.toast.content.type === ToastType.Error,
                  "scale-x-0": isTimerStarted,
                },
              )}
              onTransitionEnd={hide}
            />
            <BaseToastContent className="flex flex-row items-start justify-between gap-8 px-4 py-2">
              <Text slot="description">
                <ToastContent>{props.toast.content}</ToastContent>
              </Text>
              <Button onPress={hide}>
                <XMarkIcon className="mt-1 size-4" />
              </Button>
            </BaseToastContent>
          </div>
        </MotionBaseToast>
      )}
    </AnimatePresence>
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
