"use client";

import { Spinner } from "@pythnetwork/component-library/Spinner";
import { Suspense } from "react";

import classes from "./index.module.scss";
import {
  PythProApiTokensProvider,
  PythProAppStateProvider,
  WebSocketsProvider,
} from "../../context/pyth-pro-demo";
import { PythProDemoCards } from "../PythProDemoCards";
import { PythProDemoPriceChart } from "../PythProDemoPriceChart";
import { PythProDemoToolsMenu } from "../PythProDemoToolsMenu";

function PythFeedsDemoPageImpl() {
  return (
    <article className={classes.pythFeedsDemoPageRoot}>
      <section>
        <div className={classes.subheader}>
          <h3>Pyth Pro</h3>
          <h4>Real-time feed comparison tool</h4>
        </div>
        <div className={classes.body}>
          <PythProDemoToolsMenu />
          <PythProDemoCards />
          <PythProDemoPriceChart />
        </div>
      </section>
    </article>
  );
}

export function PythFeedsDemoPage() {
  /** local variables */
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
            <PythFeedsDemoPageImpl />
          </WebSocketsProvider>
        </PythProAppStateProvider>
      </Suspense>
    </PythProApiTokensProvider>
  );
}
