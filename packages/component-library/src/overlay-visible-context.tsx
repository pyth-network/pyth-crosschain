import type { Dispatch, SetStateAction } from "react";
import { createContext, useCallback, use } from "react";

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
    showOverlay: useCallback(() => {
      setOverlayVisible(true);
    }, [setOverlayVisible]),
    hideOverlay: useCallback(() => {
      setOverlayVisible(false);
    }, [setOverlayVisible]),
  };
};

class NotInitiializedError extends Error {
  constructor() {
    super("This component must be a child of <OverlayVisibleContextProvider>");
    this.name = "NotInitiializedError";
  }
}
