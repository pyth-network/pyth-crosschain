import { Status as StatusComponent } from "@pythnetwork/component-library/Status";

import { Status as StatusType } from "../../status";

export const Status = ({ status }: { status: StatusType }) => (
  <StatusComponent variant={getVariant(status)}>
    {getText(status)}
  </StatusComponent>
);

const getVariant = (status: StatusType) => {
  switch (status) {
    case StatusType.Active: {
      return "success";
    }
    case StatusType.Inactive: {
      return "error";
    }
    case StatusType.Unranked: {
      return "disabled";
    }
  }
};

const getText = (status: StatusType) => {
  switch (status) {
    case StatusType.Active: {
      return "Active";
    }
    case StatusType.Inactive: {
      return "Inactive";
    }
    case StatusType.Unranked: {
      return "Unranked";
    }
  }
};
