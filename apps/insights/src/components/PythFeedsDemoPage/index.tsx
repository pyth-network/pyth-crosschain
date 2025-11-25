'use client';

import classes from './index.module.scss';
import { WebSocketsProvider } from '../../context/pyth-pro-demo';
import { useSelectedDataSources } from '../../hooks/pyth-pro-demo';

export function PythFeedsDemoPage() {
  /** store */
  const { dataSourcesInUse, selectedSource } = useSelectedDataSources();

  return (
    <WebSocketsProvider>
    <article className={classes.pythFeedsDemoPageRoot}>
      <section>
        {/* <PythProDemoCards /> */}
      </section>
      <aside>
        {/* <PythProDemoPriceChart key={`${selectedSource}-${dataSourcesInUse.join(', ')}`} /> */}
      </aside>
    </article>
    </WebSocketsProvider>
  );
}