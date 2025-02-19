export enum Status {
  Unranked,
  Inactive,
  Active,
}

export const getStatus = (ranking?: { uptime_score: number }): Status => {
  if (ranking) {
    return ranking.uptime_score >= 0.5 ? Status.Active : Status.Inactive;
  } else {
    return Status.Unranked;
  }
};

export const STATUS_NAMES = {
  [Status.Active]: "Active",
  [Status.Inactive]: "Inactive",
  [Status.Unranked]: "Unranked",
} as const;

export type StatusName = (typeof STATUS_NAMES)[Status];

export const statusNameToStatus = (name: string): Status | undefined => {
  switch (name) {
    case "Active": {
      return Status.Active;
    }
    case "Inactive": {
      return Status.Inactive;
    }
    case "Unranked": {
      return Status.Unranked;
    }
    default: {
      return undefined;
    }
  }
};
