import type { ButtonHTMLAttributes } from "react";

import { Styled } from "../Styled";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean | undefined;
  secondary?: boolean | undefined;
  small?: boolean | undefined;
  nopad?: boolean | undefined;
};

const ButtonBase = ({
  loading,
  secondary,
  small,
  nopad,
  disabled,
  ...props
}: Props) => (
  <button
    disabled={loading === true || disabled === true}
    {...(loading && { "data-loading": "" })}
    {...(secondary && { "data-secondary": "" })}
    {...(small && { "data-small": "" })}
    {...(nopad && { "data-nopad": "" })}
    {...props}
  />
);

export const Button = Styled(
  ButtonBase,
  "border border-pythpurple-600 bg-pythpurple-600/50 data-[small]:text-sm data-[small]:px-6 data-[small]:py-1 data-[secondary]:bg-pythpurple-600/20 px-2 sm:px-4 md:px-8 py-2 data-[nopad]:px-0 data-[nopad]:py-0 disabled:cursor-not-allowed disabled:bg-neutral-50/10 disabled:border-neutral-50/10 disabled:text-white/60 disabled:data-[loading]:cursor-wait hover:bg-pythpurple-600/60 data-[secondary]:hover:bg-pythpurple-600/60 data-[secondary]:disabled:bg-neutral-50/10 focus-visible:ring-1 focus-visible:ring-pythpurple-400 focus:outline-none",
);
