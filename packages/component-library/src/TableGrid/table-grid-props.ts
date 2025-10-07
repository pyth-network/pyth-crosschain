import type { ColDef } from "ag-grid-community";
import type { AgGridReactProps } from "ag-grid-react";

import type { Props as CardProps } from "../Card";

type ExtendedColDef<TData> = ColDef<TData> & {
  loadingCellRenderer?: ColDef<TData>["cellRenderer"];
};

export type TableGridProps<TData extends Record<string, unknown>> = {
  rowData: TData[];
  columnDefs: ExtendedColDef<TData>[];
  cardProps?: Omit<CardProps<"div">, "children" | "footer"> & {
    nonInteractive?: true;
  };
  pagination?: boolean;
} & Omit<AgGridReactProps<TData>, "rowData" | "defaultColDef" | "columnDefs">;
