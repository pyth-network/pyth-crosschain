import type { ButtonHTMLAttributes } from "react";

import { Styled } from "../Styled";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean | undefined;
};

const ButtonBase = ({ loading, disabled, children, ...props }: Props) => (
  <button
    disabled={loading === true || disabled === true}
    {...(loading && { "data-loading": true })}
    {...props}
  >
    {children}
  </button>
);

export const Button = Styled(
  ButtonBase,
  "border border-pythpurple-600 px-2 py-0.5 bg-black/10 disabled:cursor-not-allowed disabled:bg-black/20 disabled:border-black/40 disabled:text-neutral-700 disabled:data-[loading]:cursor-wait",
);
