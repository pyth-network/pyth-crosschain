import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "../Button";

type Props = {
  children: ReactNode;
};

export const ComingSoon = ({ children }: Props) => (
  <main className="grid size-full place-content-center py-16 text-center">
    <h1 className="mb-8 text-6xl font-semibold text-pythpurple-600 dark:text-pythpurple-400">
      Coming Soon
    </h1>
    <p className="mb-20 max-w-xl text-lg">{children}</p>
    <Button as={Link} className="place-self-center px-24 py-3" href="/">
      Go Home
    </Button>
  </main>
);
