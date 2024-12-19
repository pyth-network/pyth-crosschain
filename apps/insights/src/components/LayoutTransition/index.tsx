"use client";

import {
  type TargetAndTransition,
  type Target,
  AnimatePresence,
  motion,
} from "motion/react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  type ReactNode,
  type ComponentProps,
  useContext,
  useEffect,
  useRef,
} from "react";

type OwnProps = {
  children: ReactNode;
  variants?: Record<
    string,
    | TargetAndTransition
    | ((
        custom: VariantArg,
        current: Target,
        velocity: Target,
      ) => TargetAndTransition | string)
  >;
};

export type VariantArg = {
  segment: ReturnType<typeof useSelectedLayoutSegment>;
  prevSegment: ReturnType<typeof useSelectedLayoutSegment>;
};

type Props = Omit<ComponentProps<typeof motion.div>, keyof OwnProps> & OwnProps;

export const LayoutTransition = ({ children, ...props }: Props) => {
  const segment = useSelectedLayoutSegment();
  const prevSegment =
    useRef<ReturnType<typeof useSelectedLayoutSegment>>(segment);
  const nextSegment =
    useRef<ReturnType<typeof useSelectedLayoutSegment>>(segment);

  useEffect(() => {
    nextSegment.current = segment;
  }, [segment]);

  const updatePrevSegment = () => {
    prevSegment.current = nextSegment.current;
  };

  return (
    <AnimatePresence
      mode="popLayout"
      initial={false}
      onExitComplete={updatePrevSegment}
      custom={{ segment, prevSegment: prevSegment.current }}
    >
      <motion.div
        key={segment}
        custom={{ segment, prevSegment: prevSegment.current }}
        {...props}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
};

const FrozenRouter = ({ children }: { children: ReactNode }) => {
  const context = useContext(LayoutRouterContext);
  // eslint-disable-next-line unicorn/no-null
  const prevContext = usePreviousValue(context) ?? null;

  const segment = useSelectedLayoutSegment();
  const prevSegment = usePreviousValue(segment);

  const changed = segment !== prevSegment && prevSegment !== undefined;

  return (
    <LayoutRouterContext.Provider value={changed ? prevContext : context}>
      {children}
    </LayoutRouterContext.Provider>
  );
};

const usePreviousValue = <T,>(value: T): T | undefined => {
  const prevValue = useRef<T>(undefined);

  useEffect(() => {
    prevValue.current = value;
    return () => {
      prevValue.current = undefined;
    };
  });

  return prevValue.current;
};
