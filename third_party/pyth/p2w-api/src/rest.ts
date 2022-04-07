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

// Run this function without blocking (`await`) if you want to run it async.
export async function run() {
  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());

  app.listen(restPort, () =>
    logger.debug("listening on REST port " + restPort)
  );

  // TODO: It is a stub. It will be completed in the coming PRs.
  app.get("/", (req: Request, res: Response) =>
    res.json(["HELLO-WORLD!"])
  );
}
