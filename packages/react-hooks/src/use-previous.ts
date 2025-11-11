import { useEffect, useRef } from "react";

/**
 * returns the n-1 value provided to it.
 * useful for comparing a current component
 * state value relative to a previous state value
 */
export function usePrevious<T>(val: T): T | undefined {
  /** refs */
  const prevRef = useRef<T>(undefined);

  /** effects */
  useEffect(() => {
    prevRef.current = val;
  });

  return prevRef.current;
}
