import { useLocalStorageValue } from "@react-hookz/web";
import { useCallback, useMemo } from "react";

import { messages } from "../components/Changelog";

export const useChangelog = () => {
  const lastMessageSeen = useLocalStorageValue<number>(
    "last-changelog-message-seen",
    {
      parse: (value) =>
        // eslint-disable-next-line unicorn/no-null
        value === null || value === "" ? null : Number.parseInt(value, 10),
      stringify: (value) => value.toString(),
    },
  );

  const isOpen = useMemo(() => {
    const lastClosed = lastMessageSeen.value;
    return (
      lastClosed === undefined ||
      messages.some((message) => message.id > lastClosed)
    );
  }, [lastMessageSeen.value]);

  const toggleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        lastMessageSeen.remove();
      } else {
        lastMessageSeen.set(Math.max(...messages.map(({ id }) => id)));
      }
    },
    [lastMessageSeen],
  );

  const open = useCallback(() => {
    toggleOpen(true);
  }, [toggleOpen]);

  return { isOpen, toggleOpen, open };
};
