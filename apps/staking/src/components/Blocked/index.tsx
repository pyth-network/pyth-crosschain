import { LinkButton } from "../Button";

export const Blocked = () => (
  <main className="grid size-full place-content-center py-20 text-center">
    <h1 className="mb-8 text-4xl font-semibold text-pythpurple-400">
      {"We're sorry"}
    </h1>
    <p className="mb-20 text-lg">
      This program is currently unavailable to users in your region
    </p>
    <LinkButton
      className="place-self-center px-24 py-3"
      href="https://www.pyth.network"
      target="_blank"
    >
      Read More About Pyth
    </LinkButton>
  </main>
);
