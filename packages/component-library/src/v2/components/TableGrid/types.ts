import type { ColDef } from "ag-grid-community";
import type { AgGridReactProps } from "ag-grid-react";

type ExtendedColDef<TData> = ColDef<TData> & {
  loadingCellRenderer?: ColDef<TData>["cellRenderer"];
};

export type TableGridProps<TData extends Record<string, unknown>> = {
  rowData: TData[];
  columnDefs: ExtendedColDef<TData>[];
  loading?: boolean;
} & Omit<AgGridReactProps<TData>, "rowData" | "defaultColDef" | "columnDefs">;
