"use client";

import { Spinner } from "@pythnetwork/component-library/Spinner";
import { Suspense } from "react";

import classes from "./index.module.scss";
import {
  PythProApiTokensProvider,
  PythProAppStateProvider,
  WebSocketsProvider,
} from "../../context/pyth-pro-demo";
import { PythProApiTokensMenu } from "../PythProApiTokensMenu";
import { PythProDemoCards } from "../PythProDemoCards";
import { PythProDemoPriceChart } from "../PythProDemoPriceChart";
import { PythProDemoSourceSelector } from "../PythProDemoSourceSelector";

export function PythFeedsDemoPage() {
  const suspenseLoaderLabel = "Initializing Pyth Pro demo...";

  return (
    <PythProApiTokensProvider>
      <Suspense
        fallback={
          <div className={classes.suspenseLoader}>
            <div>{suspenseLoaderLabel}</div>
            <Spinner isIndeterminate label={suspenseLoaderLabel} />
          </div>
        }
      >
        <PythProAppStateProvider>
          <WebSocketsProvider>
            <article className={classes.pythFeedsDemoPageRoot}>
              <section>
                <div className={classes.subheader}>
                  <div>
                    <h3>Pyth Pro</h3>
                    <h4>Real-time feed comparison tool</h4>
                  </div>
                  <div>
                    <PythProApiTokensMenu />
                    <PythProDemoSourceSelector />
                  </div>
                </div>
                <div className={classes.body}>
                  <PythProDemoCards />
                </div>
              </section>
              <aside>
                <PythProDemoPriceChart />
              </aside>
            </article>
          </WebSocketsProvider>
        </PythProAppStateProvider>
      </Suspense>
    </PythProApiTokensProvider>
  );
}
