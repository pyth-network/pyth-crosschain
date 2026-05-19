import type { Dispatch, SetStateAction } from "react";
import { createContext, use, useCallback } from "react";

export const OverlayVisibleContext = createContext<
  [boolean, Dispatch<SetStateAction<boolean>>] | undefined
>(undefined);

const useOverlayVisible = () => {
  const overlayVisible = use(OverlayVisibleContext);
  if (overlayVisible === undefined) {
    throw new NotInitiializedError();
  }
  return overlayVisible;
};

export const useSetOverlayVisible = () => {
  const setOverlayVisible = useOverlayVisible()[1];
  return {
    hideOverlay: useCallback(() => {
      setOverlayVisible(false);
    }, [setOverlayVisible]),
    showOverlay: useCallback(() => {
      setOverlayVisible(true);
    }, [setOverlayVisible]),
  };
};

class NotInitiializedError extends Error {
  constructor() {
    super("This component must be a child of <OverlayVisibleContextProvider>");
    this.name = "NotInitiializedError";
  }
}
