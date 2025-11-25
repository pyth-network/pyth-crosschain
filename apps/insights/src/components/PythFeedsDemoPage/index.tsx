"use client";

import classes from "./index.module.scss";
import {
  PythProApiTokensProvider,
  PythProAppStateProvider,
  WebSocketsProvider,
} from "../../context/pyth-pro-demo";
import { PythProDemoSourceSelector } from "../PythProDemoSourceSelector";

export function PythFeedsDemoPage() {
  return (
    <PythProApiTokensProvider>
      <PythProAppStateProvider>
        <WebSocketsProvider>
          <article className={classes.pythFeedsDemoPageRoot}>
            <section>
              <div className={classes.controls}>
                <PythProDemoSourceSelector />
              </div>
              {/* <PythProDemoCards /> */}
            </section>
            <aside>
              {/* <PythProDemoPriceChart key={`${selectedSource}-${dataSourcesInUse.join(', ')}`} /> */}
            </aside>
          </article>
        </WebSocketsProvider>
      </PythProAppStateProvider>
    </PythProApiTokensProvider>
  );
}
