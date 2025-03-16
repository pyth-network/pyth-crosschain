"use client";

import type { ComponentProps } from "react";
import { createContext, useContext, useState, useCallback } from "react";

const NetworkContext = createContext<undefined | NetworkContext>(undefined);

type NetworkContext = {
  isMainnet: boolean;
  toggleMainnet: (isMainnet?: boolean) => void;
};

type NetworkContextProps = Omit<
  ComponentProps<typeof NetworkContext.Provider>,
  "value"
>;

export const NetworkProvider = ({ ...props }: NetworkContextProps) => {
  const [isMainnet, setIsMainnet] = useState(true);

  const toggleMainnet = useCallback((isMainnet?: boolean) => {
    setIsMainnet(isMainnet ?? ((prev) => !prev));
  }, []);

  return (
    <NetworkContext.Provider value={{ isMainnet, toggleMainnet }} {...props} />
  );
};

export const useNetwork = () => {
  const network = useContext(NetworkContext);
  if (network) {
    return network;
  } else {
    throw new NotInitializedError();
  }
};

class NotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a `NetworkProvider`!");
    this.name = "NotInitializedError";
  }
}
