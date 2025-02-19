import type { NextRequest } from "next/server";
import { z } from "zod";
import { fromError } from "zod-validation-error";

import { getFeedScoreHistory } from "../../services/clickhouse";
import { CLUSTER_NAMES, toCluster } from "../../services/pyth";

export const GET = async (req: NextRequest) => {
  const parsed = queryParamsSchema.safeParse(
    Object.fromEntries(
      Object.keys(queryParamsSchema.shape).map((key) => [
        key,
        req.nextUrl.searchParams.get(key),
      ]),
    ),
  );
  if (parsed.success) {
    const { cluster, publisherKey, symbol, from, to } = parsed.data;
    const data = await getFeedScoreHistory(
      cluster,
      publisherKey,
      symbol,
      from,
      to,
    );
    return Response.json(data);
  } else {
    return new Response(fromError(parsed.error).toString(), {
      status: 400,
    });
  }
};

const queryParamsSchema = z.object({
  cluster: z.enum(CLUSTER_NAMES).transform((value) => toCluster(value)),
  publisherKey: z.string(),
  symbol: z.string().transform((value) => decodeURIComponent(value)),
  from: z.string(),
  to: z.string(),
});
