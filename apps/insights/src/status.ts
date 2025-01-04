export enum Status {
  Unranked,
  Inactive,
  Active,
}

export const getStatus = (ranking?: { is_active: boolean }): Status => {
  if (ranking) {
    return ranking.is_active ? Status.Active : Status.Inactive;
  } else {
    return Status.Unranked;
  }
};
