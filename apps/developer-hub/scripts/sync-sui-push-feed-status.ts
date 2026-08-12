import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ProCompatibleStatus = "available" | "coming_soon";

type SponsoredFeed = {
  alias: string;
  id: string;
  time_difference: number;
  price_deviation: number;
  confidence_ratio: number;
  pro_compatible_status?: ProCompatibleStatus;
};

type SuiPushFeedsData = {
  feeds: SponsoredFeed[];
};

type DeploymentConfig = {
  name: string;
  legacyPath: string;
  upgradedPath: string;
};

type AuditRow = {
  alias: string;
  id: string;
  docsStatus: ProCompatibleStatus;
  legacyDeployments: string[];
  upgradedDeployments: string[];
  upgradedHermes: boolean;
  expectedStatus: ProCompatibleStatus;
};

const HERMES_URL = "https://pyth.dourolabs.app/hermes/v2/price_feeds";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEVELOPER_HUB_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_DIR = path.resolve(DEVELOPER_HUB_DIR, "../..");
const DEFAULT_DEPLOYMENTS_DIR = path.resolve(REPO_DIR, "../deployments");
const SUI_MAINNET_DATA_PATH = path.join(
  DEVELOPER_HUB_DIR,
  "content/docs/price-feeds/core/push-feeds/data/sui/sui-mainnet.json",
);

const deployments: DeploymentConfig[] = [
  {
    legacyPath:
      "environments/platform-yellow/sui-price-pusher-mainnet/price-config-0.yaml",
    name: "platform-yellow",
    upgradedPath:
      "environments/platform-yellow/sui-price-pusher-mainnet/price-config-pro-compatible.yaml",
  },
  {
    legacyPath:
      "environments/platform-green/sui-price-pusher-mainnet/price-config-0.yaml",
    name: "platform-green",
    upgradedPath:
      "environments/platform-green/sui-price-pusher-mainnet/price-config-pro-compatible.yaml",
  },
];

const parseArgs = (args: string[]) => {
  const result = {
    deploymentsDir: DEFAULT_DEPLOYMENTS_DIR,
    write: false,
  };

  for (const arg of args) {
    if (arg === "--write") {
      result.write = true;
    } else if (arg.startsWith("--deployments-dir=")) {
      result.deploymentsDir = path.resolve(
        arg.slice("--deployments-dir=".length),
      );
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
};

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, "utf8")) as T;

const activePriceConfigIds = async (filePath: string): Promise<Set<string>> => {
  const ids = new Set<string>();
  let insideFeed = false;

  for (const rawLine of (await fs.readFile(filePath, "utf8")).split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("- alias:")) {
      insideFeed = true;
      continue;
    }

    if (insideFeed) {
      const match = /^id:\s*([0-9a-fA-F]{64})$/u.exec(line);
      const feedId = match?.[1];
      if (feedId !== undefined) {
        ids.add(feedId.toLowerCase());
        insideFeed = false;
      }
    }
  }

  if (ids.size === 0) {
    throw new Error(`No feed ids parsed from price config: ${filePath}`);
  }

  return ids;
};

const hermesIds = async (): Promise<Set<string>> => {
  const response = await fetch(HERMES_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch upgraded Hermes listing: ${response.status.toString()} ${response.statusText}`,
    );
  }

  const feeds = (await response.json()) as { id: string }[];
  return new Set(feeds.map((feed) => feed.id.toLowerCase()));
};

const deploymentIdSets = async (deploymentsDir: string) => {
  const legacy = new Map<string, string[]>();
  const upgraded = new Map<string, string[]>();

  for (const deployment of deployments) {
    const [legacyIds, upgradedIds] = await Promise.all([
      activePriceConfigIds(path.join(deploymentsDir, deployment.legacyPath)),
      activePriceConfigIds(path.join(deploymentsDir, deployment.upgradedPath)),
    ]);

    for (const id of legacyIds) {
      legacy.set(id, [...(legacy.get(id) ?? []), deployment.name]);
    }

    for (const id of upgradedIds) {
      upgraded.set(id, [...(upgraded.get(id) ?? []), deployment.name]);
    }
  }

  return { legacy, upgraded };
};

const auditRows = async (deploymentsDir: string): Promise<AuditRow[]> => {
  const [{ feeds }, { legacy, upgraded }, hermes] = await Promise.all([
    readJson<SuiPushFeedsData>(SUI_MAINNET_DATA_PATH),
    deploymentIdSets(deploymentsDir),
    hermesIds(),
  ]);

  return feeds.map((feed) => {
    const id = feed.id.toLowerCase();
    const upgradedDeployments = upgraded.get(id) ?? [];
    const upgradedHermes = hermes.has(id);
    const expectedStatus =
      upgradedDeployments.length > 0 && upgradedHermes
        ? "available"
        : "coming_soon";

    return {
      alias: feed.alias,
      docsStatus: feed.pro_compatible_status ?? "coming_soon",
      expectedStatus,
      id,
      legacyDeployments: legacy.get(id) ?? [],
      upgradedDeployments,
      upgradedHermes,
    };
  });
};

const writeStatuses = async (rows: AuditRow[]) => {
  const data = await readJson<SuiPushFeedsData>(SUI_MAINNET_DATA_PATH);
  const statusesById = new Map(
    rows.map((row) => [row.id, row.expectedStatus] as const),
  );

  const updatedData: SuiPushFeedsData = {
    feeds: data.feeds.map((feed) => ({
      ...feed,
      pro_compatible_status:
        statusesById.get(feed.id.toLowerCase()) ?? "coming_soon",
    })),
  };

  await fs.writeFile(
    SUI_MAINNET_DATA_PATH,
    `${JSON.stringify(updatedData, null, 2)}\n`,
  );
};

const formatDeployments = (names: string[]) =>
  names.length === 0 ? "-" : names.join("+");

const main = async () => {
  const { deploymentsDir, write } = parseArgs(process.argv.slice(2));
  const rows = await auditRows(deploymentsDir);

  if (write) {
    await writeStatuses(rows);
  }

  console.log(
    [
      "alias",
      "docs_status",
      "legacy_deployments",
      "upgraded_deployments",
      "upgraded_hermes",
      "expected_status",
    ].join(","),
  );

  for (const row of rows) {
    console.log(
      [
        row.alias,
        row.docsStatus,
        formatDeployments(row.legacyDeployments),
        formatDeployments(row.upgradedDeployments),
        row.upgradedHermes.toString(),
        row.expectedStatus,
      ].join(","),
    );
  }

  const drift = rows.filter((row) => row.docsStatus !== row.expectedStatus);
  if (drift.length > 0 && !write) {
    throw new Error(
      `Sui pro-compatible status drift detected for ${drift
        .map((row) => row.alias)
        .join(", ")}`,
    );
  }
};

await main();
