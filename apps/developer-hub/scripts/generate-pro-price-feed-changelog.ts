import * as fs from "node:fs/promises"
import path from "node:path"

const SYMBOLS_ENDPOINT =
  "https://history.pyth-lazer.dourolabs.app/history/v1/symbols"

const DATA_DIR = path.join(
  process.cwd(),
  "src/data/pro-price-feed-changelog",
)
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots")
const DAILY_ROLLUPS_PATH = path.join(DATA_DIR, "daily-rollups.json")

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type SymbolRecord = {
  pyth_lazer_id: number
  state?: string | null
  symbol?: string | null
  name?: string | null
  [key: string]: JsonValue
}

type SnapshotFile = {
  date: string
  generatedAt: string
  endpoint: string
  records: SymbolRecord[]
}

type FieldDiff = {
  path: string
  before: JsonValue
  after: JsonValue
}

type ChangeType = "went_live" | "added" | "changed" | "removed"

type ChangeEntry = {
  changeType: ChangeType
  pythLazerId: number
  symbol: string
  name: string
  statusBefore: string | null
  statusAfter: string | null
  changedFields: FieldDiff[]
}

type DailyRollup = {
  date: string
  totals: {
    went_live: number
    added: number
    changed: number
    removed: number
  }
  changes: ChangeEntry[]
}

type DailyRollupFile = {
  generatedAt: string
  endpoint: string
  days: DailyRollup[]
}

async function main() {
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true })
  const today = utcDate()
  const todaySnapshotPath = path.join(SNAPSHOTS_DIR, `${today}.json`)

  const symbols = await fetchCurrentSymbols()
  const snapshot: SnapshotFile = {
    date: today,
    generatedAt: new Date().toISOString(),
    endpoint: SYMBOLS_ENDPOINT,
    records: symbols,
  }

  if (!(await fileExists(todaySnapshotPath))) {
    await fs.writeFile(todaySnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  }

  const rollups = await computeRollups()
  const rollupFile: DailyRollupFile = {
    generatedAt: new Date().toISOString(),
    endpoint: SYMBOLS_ENDPOINT,
    days: rollups,
  }

  await fs.writeFile(DAILY_ROLLUPS_PATH, `${JSON.stringify(rollupFile, null, 2)}\n`)
}

async function fetchCurrentSymbols(): Promise<SymbolRecord[]> {
  const response = await fetch(SYMBOLS_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to fetch symbols: ${response.status} ${response.statusText}`)
  }
  const rawData = (await response.json()) as unknown
  if (!Array.isArray(rawData)) throw new Error("Unexpected symbols payload shape")

  const records = rawData
    .filter((item): item is Record<string, unknown> => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { pyth_lazer_id?: unknown }).pyth_lazer_id === "number"
      )
    })
    .map((item) => normalizeJson(item) as SymbolRecord)
    .toSorted((a, b) => a.pyth_lazer_id - b.pyth_lazer_id)

  return records
}

async function computeRollups(): Promise<DailyRollup[]> {
  const snapshots = await loadSnapshots()
  if (snapshots.length < 2) return []

  const days: DailyRollup[] = []
  for (let index = 1; index < snapshots.length; index++) {
    const previous = snapshots[index - 1]
    const current = snapshots[index]
    if (!previous || !current) continue
    days.push(buildDailyRollup({ previous, current }))
  }

  return days.toReversed()
}

async function loadSnapshots(): Promise<SnapshotFile[]> {
  const files = await fs.readdir(SNAPSHOTS_DIR)
  const snapshotFiles = files
    .filter((fileName) => fileName.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b))

  const snapshots: SnapshotFile[] = []
  for (const fileName of snapshotFiles) {
    const filePath = path.join(SNAPSHOTS_DIR, fileName)
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as SnapshotFile
    snapshots.push(parsed)
  }
  return snapshots
}

function buildDailyRollup({
  previous,
  current,
}: {
  previous: SnapshotFile
  current: SnapshotFile
}): DailyRollup {
  const previousById = new Map<number, SymbolRecord>(
    previous.records.map((record) => [record.pyth_lazer_id, record]),
  )
  const currentById = new Map<number, SymbolRecord>(
    current.records.map((record) => [record.pyth_lazer_id, record]),
  )

  const allIds = new Set<number>([...previousById.keys(), ...currentById.keys()])
  const changes: ChangeEntry[] = []

  for (const id of [...allIds].toSorted((a, b) => a - b)) {
    const before = previousById.get(id)
    const after = currentById.get(id)

    if (!before && after) {
      changes.push({
        changeType: "added",
        pythLazerId: id,
        symbol: textValue(after.symbol) ?? "unknown",
        name: textValue(after.name) ?? "unknown",
        statusBefore: null,
        statusAfter: textValue(after.state),
        changedFields: [],
      })
      continue
    }

    if (before && !after) {
      changes.push({
        changeType: "removed",
        pythLazerId: id,
        symbol: textValue(before.symbol) ?? "unknown",
        name: textValue(before.name) ?? "unknown",
        statusBefore: textValue(before.state),
        statusAfter: null,
        changedFields: [],
      })
      continue
    }

    if (!before || !after || deepEqual(before, after)) continue

    const changedFields = diffValues(before, after)
    const statusBefore = textValue(before.state)
    const statusAfter = textValue(after.state)
    const wentLive =
      statusAfter === "stable" && statusBefore !== null && statusBefore !== "stable"

    changes.push({
      changeType: wentLive ? "went_live" : "changed",
      pythLazerId: id,
      symbol: textValue(after.symbol) ?? "unknown",
      name: textValue(after.name) ?? "unknown",
      statusBefore,
      statusAfter,
      changedFields,
    })
  }

  return {
    date: current.date,
    totals: {
      went_live: changes.filter((change) => change.changeType === "went_live").length,
      added: changes.filter((change) => change.changeType === "added").length,
      changed: changes.filter((change) => change.changeType === "changed").length,
      removed: changes.filter((change) => change.changeType === "removed").length,
    },
    changes,
  }
}

function diffValues(before: JsonValue, after: JsonValue, pathPrefix = ""): FieldDiff[] {
  if (deepEqual(before, after)) return []

  const beforeIsObject = isPlainObject(before)
  const afterIsObject = isPlainObject(after)
  if (beforeIsObject && afterIsObject) {
    const beforeObject = before as Record<string, JsonValue>
    const afterObject = after as Record<string, JsonValue>
    const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)])
    const fields: FieldDiff[] = []
    for (const key of [...keys].toSorted((a, b) => a.localeCompare(b))) {
      const nextPath = pathPrefix === "" ? key : `${pathPrefix}.${key}`
      const beforeValue = beforeObject[key] ?? null
      const afterValue = afterObject[key] ?? null
      fields.push(...diffValues(beforeValue, afterValue, nextPath))
    }
    return fields
  }

  return [
    {
      path: pathPrefix === "" ? "$" : pathPrefix,
      before,
      after,
    },
  ]
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function normalizeJson(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJson)
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>
    const normalized: Record<string, JsonValue> = {}
    for (const key of Object.keys(record).toSorted((a, b) => a.localeCompare(b))) {
      normalized[key] = normalizeJson(record[key])
    }
    return normalized
  }

  return String(value)
}

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textValue(value: JsonValue | undefined): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function utcDate() {
  return new Date().toISOString().slice(0, 10)
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

await main()
