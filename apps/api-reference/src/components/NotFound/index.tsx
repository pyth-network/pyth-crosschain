import Link from "next/link";

import { Button } from "../Button";

export const NotFound = () => (
  <main className="grid size-full place-content-center text-center">
    <h1 className="mb-8 text-6xl font-semibold text-pythpurple-600 dark:text-pythpurple-400">
      Not Found
    </h1>
    <p className="mb-20 text-lg font-medium">
      {"The page you're looking for isn't here"}
    </p>
    <Button as={Link} className="place-self-center px-24 py-3" href="/">
      Go Home
    </Button>
  </main>
);
