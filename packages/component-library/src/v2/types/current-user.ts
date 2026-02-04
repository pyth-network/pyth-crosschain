export type CurrentUser = {
  /**
   * current user's unique avatar URL (TBD, might not be needed)
   */
  avatarUrl?: string;

  /**
   * current user's valid email address
   */
  email: string;

  /**
   * current user's full name (first and last, separated by a space)
   */
  fullName: string;
};
