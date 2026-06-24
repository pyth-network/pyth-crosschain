import { getChangeLog } from "../ChangeLog/data";
import { ChangelogBarRow } from "./ChangelogBarRow";

// Upper bound on the events handed to the client. It renders as many as fit on
// one line and collapses the remainder into a "+N more" link, so this only caps
// how deep the overflow can ever go on very wide screens.
const MAX_CANDIDATES = 14;

export const ChangelogBar = () => {
  const { days } = getChangeLog();

  // `days` is ordered oldest-first; reverse so the newest changes lead.
  const items = [...days]
    .reverse()
    .flatMap((day) => day.events)
    .slice(0, MAX_CANDIDATES)
    .map((entry) => ({ changeType: entry.changeType, id: entry.id }));

  if (items.length === 0) {
    return null;
  }

  return <ChangelogBarRow items={items} />;
};
