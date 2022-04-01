import { Request, Response } from "express";
import { envOrErr } from "./helpers";
import { Listener } from "./listen";
import { logger } from "./logging";


export class RestAPI {
  private port: number;
  private listener: Listener;

  constructor(config: { port: number; }, listener: Listener) {
    this.port = config.port;
    this.listener = listener;
  }

  // Run this function without blocking (`await`) if you want to run it async.
  async run() {
    const express = require("express");
    const cors = require("cors");
    const app = express();
    app.use(cors());

    app.listen(this.port, () =>
      logger.debug("listening on REST port " + this.port)
    );

    app.get("/price_feed_latest_vaa/:price_feed_id", async (req: Request, res: Response) => {
      let result = this.listener.getPriceFeedLatestVAA(req.params.price_feed_id);

      if (result === null) {
        res.sendStatus(404);
        return;
      }

      res.json(result);
    });

    app.get("/", (req: Request, res: Response) =>
      res.json(["price_feed_latest_vaa/<price_feed_id>"])
    );
  }
}
