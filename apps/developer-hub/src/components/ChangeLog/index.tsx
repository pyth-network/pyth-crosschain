import { ChangeLogView } from "./ChangeLogView";
import { getChangeLog } from "./data";

export const ChangeLog = () => <ChangeLogView log={getChangeLog()} />;
