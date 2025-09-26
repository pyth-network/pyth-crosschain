import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community';
import { AgGridReact, type CustomLoadingCellRendererProps } from 'ag-grid-react'; // React Data Grid Component
import { useCallback, useMemo, useState } from 'react';
import styles from './index.module.scss';
import { themeQuartz } from 'ag-grid-community';
import type { CustomLoadingCellRendererProps } from 'ag-grid-react';
import { Skeleton } from '../Skeleton';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule,]);

const SkeletonCellRenderer = (props) => {
    console.log(props);
  if (!props.value) {
    return <Skeleton fill />;
  }
  return <span>{props.value}</span>;
};

type ExtendedColDef = ColDef & {
    loadingSkeletonWidth?: number;
}

export type TableGridProps = {
    rowData: Record<string, unknown>[];
    colDefs: ExtendedColDef[];
}
export const TableGrid = ({ rowData, colDefs }: TableGridProps) => {
   // Row Data: The data to be displayed.
    // const [rowData, setRowData] = useState([
    //     { make: undefined, model: "Model Y", price: 64950, electric: true },
    //     { make: "Ford", model: "F-Series", price: 33850, electric: false },
    //     { make: "Toyota", model: "Corolla", price: 29600, electric: false },
    // ]);

    // // Column Definitions: Defines the columns to be displayed.
    // const [colDefs, setColDefs] = useState([
    //     { field: "make", cellRenderer: SkeletonCellRenderer },
    //     { field: "model", cellRenderer: SkeletonCellRenderer },
    //     { field: "price", cellRenderer: SkeletonCellRenderer },
    //     { field: "electric", cellRenderer: SkeletonCellRenderer }
    // ]);

  const defaultColDef = useMemo(() => {
    return {
      cellRenderer: SkeletonCellRenderer,
    };
  }, []);
    return <div className={styles.tableGrid}>
        <AgGridReact
        // loadingCellRenderer={loadingCellRenderer}
        // loadingCellRendererParams={loadingCellRendererParams}
            rowData={rowData}
            defaultColDef={defaultColDef}
            columnDefs={colDefs}
            theme={themeQuartz}
        />
    </div>
}