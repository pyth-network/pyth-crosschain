import { Status as StatusComponent } from "@pythnetwork/component-library/Status";

import { Status as StatusType } from "../../status";

export const Status = ({ status }: { status: StatusType }) => (
  <StatusComponent variant={getVariant(status)}>
    {getText(status)}
  </StatusComponent>
);

const getVariant = (status: StatusType) => {
  switch (status) {
    case StatusType.Live: {
      return "success";
    }
    case StatusType.Down: {
      return "error";
    }
    // case StatusType.Unranked: {
    //   return "disabled";
    // }
  }
};

const getText = (status: StatusType) => {
  switch (status) {
    case StatusType.Live: {
      return "Live";
    }
    case StatusType.Down: {
      return "Down";
    }
    // case StatusType.Unranked: {
    //   return "Unranked";
    // }
  }
};
