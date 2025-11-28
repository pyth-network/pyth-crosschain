import type Sockette from "sockette";

export type UseDataProviderSocketHookReturnType = {
  onMessage: (
    socket: Sockette,
    usdtToUsdRate: number,
    socketData: string,
  ) => void;
  onOpen?: (
    socket: Sockette,
    ...rest: Parameters<NonNullable<WebSocket["onopen"]>>
  ) => void;
};
