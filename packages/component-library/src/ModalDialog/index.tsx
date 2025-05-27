"use client";

import type { MotionProps, PanInfo } from "motion/react";
import { motion } from "motion/react";
import type {
  ComponentProps,
  ComponentType,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";
import {
  createContext,
  use,
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
  useReducer,
} from "react";
import type { ModalRenderProps } from "react-aria-components";
import {
  Modal,
  ModalOverlay,
  Dialog,
  DialogTrigger,
  Select,
} from "react-aria-components";

import { useSetOverlayVisible } from "../overlay-visible-context.jsx";

// These types are absurd, but the annotations have to be here or else we get a
// TS2742 due to some issue in how framer-motion is packaged.  Eventually it
// would be great to figure out what about framer-motion's packaging causes this
// to be required, and to find a way to make it a nonissue, but for now these
// annotations will allow us to move on...
const MotionModalOverlay: ComponentType<
  Omit<ComponentProps<typeof ModalOverlay>, keyof MotionProps> &
    Omit<MotionProps, "children"> & {
      children?:
        | MotionProps["children"]
        | ComponentProps<typeof ModalOverlay>["children"];
    }
> = motion.create(ModalOverlay);
const MotionDialog: ComponentType<
  Omit<ComponentProps<typeof Dialog>, keyof MotionProps> &
    Omit<MotionProps, "children"> & {
      children?:
        | MotionProps["children"]
        | ComponentProps<typeof Dialog>["children"];
    }
> = motion.create(Dialog);

export const ModalDialogTrigger = (
  props: ComponentProps<typeof DialogTrigger>,
) => {
  const [animation, setAnimation] = useState<AnimationState>("unmounted");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setAnimation(isOpen ? "visible" : "hidden");
    },
    [setAnimation],
  );

  useEffect(() => {
    if (props.defaultOpen) {
      setAnimation("visible");
    }
  }, [props.defaultOpen]);

  return (
    <ModalAnimationContext value={[animation, setAnimation]}>
      <DialogTrigger onOpenChange={handleOpenChange} {...props} />
    </ModalAnimationContext>
  );
};

export const ModalSelect = (props: ComponentProps<typeof DialogTrigger>) => {
  const [animation, setAnimation] = useState<AnimationState>("unmounted");

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setAnimation(isOpen ? "visible" : "hidden");
    },
    [setAnimation],
  );

  return (
    <ModalAnimationContext value={[animation, setAnimation]}>
      <Select onOpenChange={handleOpenChange} {...props} />
    </ModalAnimationContext>
  );
};

const ModalAnimationContext = createContext<
  [AnimationState, Dispatch<SetStateAction<AnimationState>>] | undefined
>(undefined);

type OwnProps = Pick<ComponentProps<typeof Modal>, "children"> &
  Pick<ComponentProps<typeof MotionModalOverlay>, "isOpen" | "onOpenChange"> & {
    overlayClassName?:
      | ComponentProps<typeof MotionModalOverlay>["className"]
      | undefined;
    overlayVariants?:
      | ComponentProps<typeof MotionModalOverlay>["variants"]
      | undefined;
    onClose?: (() => void) | undefined;
    onCloseFinish?: (() => void) | undefined;
    onOpenFinish?: (() => void) | undefined;
    onDragEnd?: (
      e: MouseEvent | TouchEvent | PointerEvent,
      panInfo: PanInfo,
      modalState: ModalRenderProps,
    ) => void;
  };

type Props = Omit<ComponentProps<typeof MotionDialog>, keyof OwnProps> &
  OwnProps;

export const ModalDialog = ({
  isOpen,
  onOpenChange,
  onClose,
  onCloseFinish,
  onOpenFinish,
  overlayClassName,
  overlayVariants,
  children,
  onDragEnd,
  ...props
}: Props) => {
  const contextAnimationState = use(ModalAnimationContext);
  const localAnimationState = useState<AnimationState>("unmounted");
  const [animation, setAnimation] =
    contextAnimationState ?? localAnimationState;
  const { hideOverlay, showOverlay } = useSetOverlayVisible();

  const startAnimation = (animation: AnimationState) => {
    if (animation === "visible") {
      showOverlay();
    } else if (animation === "hidden") {
      onClose?.();
    }
  };

  const endAnimation = (animation: AnimationState) => {
    if (animation === "hidden") {
      hideOverlay();
      onCloseFinish?.();
    } else if (animation === "visible") {
      onOpenFinish?.();
    }
    setAnimation((a) => {
      return animation === "hidden" && a === "hidden" ? "unmounted" : a;
    });
  };

  useEffect(() => {
    if (isOpen !== undefined) {
      setAnimation((a) => {
        if (isOpen) {
          return "visible";
        } else {
          return a === "visible" ? "hidden" : a;
        }
      });
    }
  }, [isOpen, setAnimation]);

  return (
    <MotionModalOverlay
      isDismissable
      isExiting={animation === "hidden"}
      onAnimationStart={startAnimation}
      onAnimationComplete={endAnimation}
      initial="unmounted"
      animate={animation}
      {...(onOpenChange && { onOpenChange })}
      {...(overlayVariants && { variants: overlayVariants })}
      {...(overlayClassName && { className: overlayClassName })}
      {...(isOpen !== undefined && { isOpen })}
    >
      <Modal style={{ height: 0 }}>
        {(...args) => (
          <MotionDialog
            {...props}
            {...(onDragEnd && {
              onDragEnd: (e, info) => {
                onDragEnd(e, info, args[0]);
              },
            })}
          >
            {typeof children === "function" ? children(...args) : children}
          </MotionDialog>
        )}
      </Modal>
    </MotionModalOverlay>
  );
};

type AnimationState = "unmounted" | "hidden" | "visible";

export const createModalDialogContext = <
  T extends Props,
  U = Record<never, never>,
>(
  Component: ComponentType<T>,
) => {
  type ContextType = {
    close: () => Promise<void>;
    open: (modalDialogProps: ModalDialogProps<T, U>) => void;
  };

  const Context = createContext<ContextType | undefined>(undefined);

  enum StateType {
    Closed,
    Opening,
    Open,
    Closing,
    Replacing,
  }
  const State = {
    Closed: () => ({ type: StateType.Closed as const }),
    Opening: (props: ModalDialogProps<T, U>) => ({
      type: StateType.Opening as const,
      props,
    }),
    Open: (props: ModalDialogProps<T, U>) => ({
      type: StateType.Open as const,
      props,
    }),
    Closing: (props: ModalDialogProps<T, U>) => ({
      type: StateType.Closing as const,
      props,
    }),
    Replacing: (
      oldProps: ModalDialogProps<T, U>,
      newProps: ModalDialogProps<T, U>,
    ) => ({ type: StateType.Replacing as const, oldProps, newProps }),
  };
  type State = ReturnType<(typeof State)[keyof typeof State]>;

  enum ActionType {
    Open,
    OpenFinish,
    Close,
    CloseFinish,
  }
  const Action = {
    Open: (props: ModalDialogProps<T, U>) => ({
      type: ActionType.Open as const,
      props,
    }),
    OpenFinish: () => ({ type: ActionType.OpenFinish as const }),
    Close: () => ({ type: ActionType.Close as const }),
    CloseFinish: () => ({ type: ActionType.CloseFinish as const }),
  };
  type Action = ReturnType<(typeof Action)[keyof typeof Action]>;

  const reducer = (state: State, action: Action) => {
    switch (action.type) {
      case ActionType.Open: {
        switch (state.type) {
          case StateType.Closed: {
            return State.Opening(action.props);
          }
          case StateType.Closing:
          case StateType.Open:
          case StateType.Opening: {
            return State.Replacing(state.props, action.props);
          }
          case StateType.Replacing: {
            return State.Replacing(state.oldProps, action.props);
          }
        }
      }
      // This rule is a false positive because typescript ensures we never
      // fallthough, and adding a `break` above triggers an unreachable code
      // error
      // eslint-disable-next-line no-fallthrough
      case ActionType.OpenFinish: {
        switch (state.type) {
          case StateType.Opening: {
            return State.Open(state.props);
          }
          case StateType.Closed:
          case StateType.Closing:
          case StateType.Replacing:
          case StateType.Open: {
            return state;
          }
        }
      }
      // This rule is a false positive because typescript ensures we never
      // fallthough, and adding a `break` above triggers an unreachable code
      // error
      // eslint-disable-next-line no-fallthrough
      case ActionType.Close: {
        switch (state.type) {
          case StateType.Open:
          case StateType.Opening: {
            return State.Closing(state.props);
          }
          case StateType.Replacing: {
            return State.Closing(state.oldProps);
          }
          case StateType.Closed:
          case StateType.Closing: {
            return state;
          }
        }
      }
      // This rule is a false positive because typescript ensures we never
      // fallthough, and adding a `break` above triggers an unreachable code
      // error
      // eslint-disable-next-line no-fallthrough
      case ActionType.CloseFinish: {
        switch (state.type) {
          case StateType.Closing: {
            return State.Closed();
          }
          case StateType.Replacing: {
            return State.Opening(state.newProps);
          }
          case StateType.Closed:
          case StateType.Open:
          case StateType.Opening: {
            return state;
          }
        }
      }
    }
  };

  return {
    Provider: ({ children, ...ctxProps }: U & { children: ReactNode }) => {
      const closeResolvers = useRef<(() => void)[]>([]);
      const [state, dispatch] = useReducer<State, [Action]>(
        reducer,
        State.Closed(),
      );
      const open = useCallback(
        (props: ModalDialogProps<T, U>) => {
          dispatch(Action.Open(props));
        },
        [dispatch],
      );
      const close = useCallback(() => {
        dispatch(Action.Close());
        return new Promise<void>((resolve) =>
          closeResolvers.current.push(resolve),
        );
      }, [dispatch]);
      const value = useMemo(() => ({ open, close }), [open, close]);
      const handleOpenFinish = useCallback(() => {
        dispatch(Action.OpenFinish());
      }, [dispatch]);
      const handleCloseFinish = useCallback(() => {
        let onCloseFinished;
        if (state.type === StateType.Closing) {
          onCloseFinished = state.props.onCloseFinished;
        }
        dispatch(Action.CloseFinish());
        onCloseFinished?.();
        for (const resolver of closeResolvers.current) {
          resolver();
        }
        closeResolvers.current = [];
      }, [dispatch, state]);
      const handleOpenChange = useCallback(
        (isOpen: boolean) => {
          if (!isOpen) {
            dispatch(Action.Close());
          }
        },
        [dispatch],
      );

      return (
        <Context value={value}>
          {children}
          {state.type !== StateType.Closed && (
            // @ts-expect-error TODO typescript isn't validating this type
            // properly.  To be honest, I'm not sure why, but the code for
            // `createModalDialogContext` is pretty messy and I think
            // simplifying this would probably resolve the issue.  I'll come
            // back and refactor this eventually and see if this goes away...
            <Component
              isOpen={
                state.type === StateType.Open ||
                state.type === StateType.Opening
              }
              onOpenChange={handleOpenChange}
              onOpenFinish={handleOpenFinish}
              onCloseFinish={handleCloseFinish}
              {...ctxProps}
              {...(state.type === StateType.Replacing
                ? state.oldProps
                : state.props)}
            />
          )}
        </Context>
      );
    },

    useValue: () => {
      const value = use(Context);
      if (value === undefined) {
        throw new ContextNotInitializedError();
      } else {
        return value;
      }
    },
  };
};

export type ModalDialogProps<T, U = undefined> = Omit<
  T,
  "isOpen" | "onOpenChange" | "onCloseFinish" | keyof U
> & {
  onClose?: (() => void) | undefined;
  onCloseFinished?: (() => void) | undefined;
};

class ContextNotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a provider");
    this.name = "ContextNotInitializedError";
  }
}
