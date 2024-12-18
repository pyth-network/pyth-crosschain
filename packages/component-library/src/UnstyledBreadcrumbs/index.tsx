/**
 * The react-aria components aren't marked as "use client" so it's a bit
 * obnoxious to use them; this file just adds a client boundary and re-exports
 * the react-aria components to avoid that problem.
 */

"use client";

export {
  Breadcrumbs as UnstyledBreadcrumbs,
  Breadcrumb as UnstyledBreadcrumb,
} from "react-aria-components";