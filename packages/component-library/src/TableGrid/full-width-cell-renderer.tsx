import type { ICellRendererParams } from 'ag-grid-community';

export const FullWidthCellRenderer = colDefs => (props: ICellRendererParams) => {
    console.log({props, colDefs});
  return (
    <div className="full-width-panel p-4">
      <h3 className="font-bold">Full Width Row</h3>
      <p>Row data: {JSON.stringify(props.data)}</p>
    </div>
  );
};