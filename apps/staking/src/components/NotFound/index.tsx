import { LinkButton } from "../Button";

export const NotFound = () => (
  <main className="grid size-full place-content-center py-20 text-center">
    <h1 className="mb-8 text-4xl font-semibold text-pythpurple-400">
      Not Found
    </h1>
    <p className="mb-20 text-lg">{"The page you're looking for isn't here"}</p>
    <LinkButton className="place-self-center px-24 py-3" href="/">
      Go Home
    </LinkButton>
  </main>
);
