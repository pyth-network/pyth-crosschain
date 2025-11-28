"use client";

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
  return (
    <PythProApiTokensProvider>
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
    </PythProApiTokensProvider>
  );
}
