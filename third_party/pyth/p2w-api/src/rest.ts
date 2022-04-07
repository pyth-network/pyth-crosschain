import { Request, Response } from "express";
import { envOrErr } from "./helpers";
import { logger } from "./logging";


export class RestAPI {
  private port: number;

  constructor(config: { port: number; }) {
    this.port = config.port;
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

    // TODO: It is a stub. It will be completed in the coming PRs.
    app.get("/", (req: Request, res: Response) =>
      res.json(["HELLO-WORLD!"])
    );
  }
}
