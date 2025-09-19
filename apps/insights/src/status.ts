export enum Status {
  Down,
  Live,
}

export const STATUS_NAMES = {
  [Status.Live]: "Live",
  [Status.Down]: "Down",
} as const;

export type StatusName = (typeof STATUS_NAMES)[Status];

export const statusNameToStatus = (name: string): Status | undefined => {
  switch (name) {
    case "Live": {
      return Status.Live;
    }
    case "Down": {
      return Status.Down;
    }
    default: {
      return undefined;
    }
  }
};
