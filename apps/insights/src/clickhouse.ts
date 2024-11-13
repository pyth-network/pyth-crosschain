import { createClient } from "@clickhouse/client";

import { CLICKHOUSE } from "./config/server";

export const client = createClient(CLICKHOUSE);
