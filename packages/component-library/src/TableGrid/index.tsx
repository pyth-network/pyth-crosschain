import type { ColDef } from "ag-grid-community";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import type { AgGridReactProps } from "ag-grid-react"; // React Data Grid Component
import { AgGridReact } from "ag-grid-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";

import type { Props as CardProps } from "../Card";
import { Card } from "../Card";
import { Paginator } from "../Paginator";
import { Skeleton } from "../Skeleton";
import styles from "./index.module.scss";

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const SkeletonCellRenderer = (props: { value?: unknown }) => {
  if (!props.value) {
    return <Skeleton fill />;
  }
  return <span>{props.value}</span>;
};

type ExtendedColDef<TData> = ColDef<TData> & {
  loadingSkeletonWidth?: number;
};

export type TableGridProps<TData extends Record<string, unknown>> = {
  rowData: TData[];
  colDefs: ExtendedColDef<TData>[];
  isLoading?: boolean;
  cardProps?: Omit<CardProps<"div">, "children" | "footer"> & { nonInteractive?: true };
  pagination?: boolean;
} & Omit<AgGridReactProps<TData>, "rowData" | "defaultColDef" | "columnDefs">;

export const TableGrid = forwardRef(<TData extends Record<string, unknown>>({
  rowData,
  colDefs,
  isLoading,
  cardProps,
  pagination,
  ...props
}: TableGridProps<TData>, ref: React.Ref<AgGridReact<TData>>) => {
  const gridRef = useRef<AgGridReact<TData>>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
    useImperativeHandle(ref, () => gridRef.current);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      cellRenderer: SkeletonCellRenderer,
      flex: 1,
    };
  }, []);

  const emptyRowData = useMemo(() => {
    // create dummy row matching the shape of colDefs
    return [colDefs.map(() => ({ value: undefined }))];
  }, [colDefs]);

  const onPaginationChanged = useCallback(() => {
    if (gridRef.current?.api) {
      const api = gridRef.current.api;
      setPageSize(api.paginationGetPageSize());
      setCurrentPage(api.paginationGetCurrentPage() + 1);
      setTotalPages(api.paginationGetTotalPages());
    }
  }, []);

  const onPageChange = useCallback((newPage: number) => {
    gridRef.current?.api.paginationGoToPage(newPage - 1);
  }, []);

  const tableGrid = (
      <AgGridReact<TData>
        className={styles.tableGrid}
        ref={gridRef}
        rowData={isLoading ? emptyRowData : rowData}
        defaultColDef={defaultColDef}
        columnDefs={colDefs}
        theme={themeQuartz}
        domLayout="autoHeight"
        pagination={pagination ?? false}
        paginationPageSize={pageSize}
        suppressPaginationPanel
        onPaginationChanged={onPaginationChanged}
        {...props}
      />
  );
  if (!cardProps && !pagination) {
    return tableGrid;
  }
  return (
    <Card
      footer={
        pagination && (
          <Paginator
            numPages={totalPages}
            currentPage={currentPage}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )
      }
      {...cardProps}
    >
      {tableGrid}
    </Card>
  );
});

TableGrid.displayName = "TableGrid";
