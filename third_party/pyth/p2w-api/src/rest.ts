import { Request, Response } from "express";
import { logger } from "./helpers";

let restPort: number = 0;

export function init(): boolean {
  if (!process.env.REST_PORT) {
    logger.error("Missing environment variable REST_PORT");
    return false;
  }

  restPort = parseInt(process.env.REST_PORT);
  return true;
}

export async function run() {
  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  app.listen(restPort, () =>
    logger.debug("listening on REST port " + restPort)
  );

  (async () => {
    app.get("/", (req: Request, res: Response) =>
      res.json(["HELLO-WORLD!"])
    );
  })();
}
