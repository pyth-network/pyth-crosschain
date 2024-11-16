/**
 * The react-aria components aren't marked as "use client" so it's a bit
 * obnoxious to use them; this file just adds a client boundary and re-exports
 * the react-aria components to avoid that problem.
 */

"use client";

export {
  Cell as UnstyledCell,
  Column as UnstyledColumn,
  Row as UnstyledRow,
  Table as UnstyledTable,
  TableBody as UnstyledTableBody,
  TableHeader as UnstyledTableHeader,
} from "react-aria-components";
