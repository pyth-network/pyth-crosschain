"use client";

import type { Placement } from "@floating-ui/react";
import {
  FloatingArrow,
  FloatingPortal,
  useFloating,
  useInteractions,
  useHover,
  useFocus,
  useRole,
  useDismiss,
  useTransitionStyles,
  useMergeRefs,
  useDelayGroup,
  autoPlacement,
  arrow,
  offset,
  autoUpdate,
  flip,
  shift,
} from "@floating-ui/react";
import type { ComponentProps, ElementType, Ref } from "react";
import {
  useState,
  useMemo,
  createContext,
  useContext,
  forwardRef,
  useRef,
  createElement,
} from "react";

type TooltipOptions = {
  arrow?: { width: number; height: number };
  gap?: number;
  initialOpen?: boolean;
  placement?: Placement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const TooltipBase = ({
  children,
  ...options
}: { children: React.ReactNode } & TooltipOptions) => {
  const tooltip = useTooltip(options);
  return (
    <TooltipContext.Provider value={tooltip}>
      {children}
    </TooltipContext.Provider>
  );
};

const TooltipContext = createContext<ReturnType<typeof useTooltip> | undefined>(
  undefined,
);

const useTooltip = ({
  arrow: arrowConfig,
  gap = 5,
  initialOpen = false,
  placement,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: TooltipOptions = {}) => {
  const arrowRef = useRef(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const data = useFloating({
    ...(placement && { placement }),
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(gap + (arrowConfig?.width ?? 0)),
      placement ? flip() : autoPlacement(),
      shift(),
      ...(arrowConfig ? [arrow({ element: arrowRef })] : []),
    ],
  });

  const context = data.context;

  const { delay } = useDelayGroup(context);

  const hover = useHover(context, {
    move: false,
    enabled: controlledOpen == undefined,
    delay,
  });
  const focus = useFocus(context, {
    enabled: controlledOpen == undefined,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const interactions = useInteractions([hover, focus, dismiss, role]);

  return useMemo(
    () => ({
      open,
      setOpen,
      ...(arrowConfig && { arrow: { config: arrowConfig, ref: arrowRef } }),
      ...interactions,
      ...data,
    }),
    [open, setOpen, interactions, data, arrowConfig],
  );
};

const useTooltipState = () => {
  const context = useContext(TooltipContext);

  if (context === undefined) {
    throw new Error("Tooltip components must be wrapped in <Tooltip />");
  } else {
    return context;
  }
};

const TooltipTrigger = <T extends ElementType = "button">(
  { as, ...props }: Omit<ComponentProps<T>, "as"> & { as?: T },
  propRef: Ref<HTMLElement>,
) => {
  const state = useTooltipState();

  return createElement(as ?? "button", {
    ref: useMergeRefs([state.refs.setReference, propRef]),
    "data-state": state.open ? "open" : "closed",
    ...state.getReferenceProps(props),
  });
};

const TooltipContent = <T extends ElementType = "div">(
  { as, ...props }: Omit<ComponentProps<T>, "as"> & { as?: T },
  propRef: Ref<HTMLDivElement>,
) => {
  const state = useTooltipState();
  const delayGroupContext = useDelayGroup(state.context);
  const ref = useMergeRefs([state.refs.setFloating, propRef]);

  useDelayGroup(state.context, { id: state.context.floatingId });

  const instantDuration = 0;
  const duration = 250;

  const { isMounted, styles } = useTransitionStyles(state.context, {
    duration: delayGroupContext.isInstantPhase
      ? {
          open: instantDuration,
          // `id` is this component's `id`
          // `currentId` is the current group's `id`
          close:
            delayGroupContext.currentId === state.context.floatingId
              ? duration
              : instantDuration,
        }
      : duration,
    initial: {
      opacity: 0,
    },
  });

  return isMounted ? (
    <FloatingPortal>
      {createElement(as ?? "div", {
        ref,
        style: {
          ...state.floatingStyles,
          ...props.style,
          ...styles,
        },
        ...state.getFloatingProps(props),
      })}
    </FloatingPortal>
  ) : // eslint-disable-next-line unicorn/no-null
  null;
};

const TooltipArrow = (
  props: Omit<
    ComponentProps<typeof FloatingArrow>,
    "ref" | "context" | "height" | "width"
  >,
) => {
  const { arrow, context } = useTooltipState();

  if (!arrow) {
    throw new Error(
      "You must set the `arrow` option on the Tooltip component to use arrows",
    );
  }

  return (
    <FloatingArrow
      ref={arrow.ref}
      context={context}
      height={arrow.config.width}
      width={arrow.config.height}
      {...props}
    />
  );
};

export const Tooltip = Object.assign(TooltipBase, {
  Trigger: forwardRef(TooltipTrigger),
  Content: forwardRef(TooltipContent),
  Arrow: TooltipArrow,
});
