import express from "express";
import cors from "cors";
import { Request, Response } from "express";
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
    const app = express();
    app.use(cors());

    app.listen(this.port, () =>
      logger.debug("listening on REST port " + this.port)
    );

    app.get("/latest_vaa_bytes/:price_feed_id", (req: Request, res: Response) => {
      let latestVAA = this.listener.getPriceFeedLatestVAA(req.params.price_feed_id);

      if (latestVAA === undefined) {
        res.sendStatus(404);
        return;
      }

      res.status(200);
      res.write(latestVAA.vaaBytes);
      res.end();
    });

    app.get("/", (_, res: Response) =>
      res.json(["latest_vaa_bytes/<price_feed_id>"])
    );
  }
}
