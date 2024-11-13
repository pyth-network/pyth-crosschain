import { ButtonLink } from "@pythnetwork/component-library/Button";

import { MaxWidth } from "../MaxWidth";

export const NotFound = () => (
  <MaxWidth>
    <h1>Not Found</h1>
    <p>{"The page you're looking for isn't here"}</p>
    <ButtonLink href="/">Go Home</ButtonLink>
  </MaxWidth>
);
