import {
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
  createContext,
  useState,
  useCallback,
  use,
} from "react";

export const OverlayVisibleContext = createContext<
  [boolean, Dispatch<SetStateAction<boolean>>] | undefined
>(undefined);

export const OverlayVisibleContextProvider = (
  props: Omit<ComponentProps<typeof OverlayVisibleContext>, "value">,
) => {
  const overlayVisibleState = useState(false);
  return <OverlayVisibleContext value={overlayVisibleState} {...props} />;
};

const useOverlayVisible = () => {
  const overlayVisible = use(OverlayVisibleContext);
  if (overlayVisible === undefined) {
    throw new NotInitiializedError();
  }
  return overlayVisible;
};

export const useIsOverlayVisible = () => useOverlayVisible()[0];
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
