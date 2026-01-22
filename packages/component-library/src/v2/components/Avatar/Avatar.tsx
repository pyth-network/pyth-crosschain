import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import cx from "clsx";
import { useMemo } from "react";

import { classes } from "./Avatar.styles";
import type { CurrentUser } from "../../types/current-user";

export type AvatarProps = {
  /**
   * css class name override
   */
  className?: string;

  /**
   * user whose avatar will be displayed
   */
  user: CurrentUser;
};

export function Avatar({ className, user }: AvatarProps) {
  /** local variables */
  const { email, fullName } = user;

  /** memos */
  const initials = useMemo(() => {
    const [firstname = "", lastname = ""] = fullName.split(/\s+/);
    let firstInitial = firstname.charAt(0);
    const lastInitial = lastname.charAt(0);

    if (!firstInitial) {
      // use email instead and just grab the first character
      firstInitial = email.charAt(0);
    }

    return `${firstInitial}${lastInitial}`.toUpperCase().trim();
  }, [email, fullName]);

  return (
    <BaseAvatar.Root className={cx(classes.root, className)}>
      <BaseAvatar.Image src={user.avatarUrl} />
      <BaseAvatar.Fallback>{initials}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
