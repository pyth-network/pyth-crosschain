import { Request, Response } from "express";
import { logger } from "./helpers";
import { getStatus, getPriceData, isHealthy } from "./worker";

let restPort: number = 0;

export function init(runRest: boolean): boolean {
  if (!runRest) return true;
  if (!process.env.REST_PORT) return true;

  restPort = parseInt(process.env.REST_PORT);
  return true;
}

export async function run() {
  if (restPort == 0) return;

  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  app.listen(restPort, () =>
    logger.debug("listening on REST port " + restPort)
  );

  (async () => {
    app.get("/status", async (req: Request, res: Response) => {
      let result = await getStatus();
      res.json(result);
    });

    app.get(
      "/queryterra/:price_id",
      async (req: Request, res: Response) => {
        let result = await getPriceData(
          req.params.price_id
        );
        res.json(result);
      }
    );

    app.get("/health", async (req: Request, res: Response) => {
      if (isHealthy()) {
        res.sendStatus(200);
      } else {
        res.sendStatus(503);
      }
    });

    app.get("/", (req: Request, res: Response) =>
      res.json(["/status", "/queryterra/<price_id>", "/health"])
    );
  })();
}
