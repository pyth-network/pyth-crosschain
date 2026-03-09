"use client"

import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp"
import { Info } from "@phosphor-icons/react/dist/ssr/Info"
import { Badge } from "@pythnetwork/component-library/Badge"
import { Button } from "@pythnetwork/component-library/Button"
import { Card } from "@pythnetwork/component-library/Card"
import { NoResults } from "@pythnetwork/component-library/NoResults"
import { Paginator } from "@pythnetwork/component-library/Paginator"
import { SearchInput } from "@pythnetwork/component-library/SearchInput"
import { Switch } from "@pythnetwork/component-library/Switch"
import type { ColumnConfig } from "@pythnetwork/component-library/Table"
import { Table } from "@pythnetwork/component-library/Table"
import { useMemo, useState } from "react"

import changelogData from "../../data/pro-price-feed-changelog/daily-rollups.json"
import styles from "./index.module.scss"

type ChangeType = "went_live" | "added" | "changed" | "removed"

type FieldDiff = {
  path: string
  before: unknown
  after: unknown
}

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
  totals: Record<ChangeType, number>
  changes: ChangeEntry[]
}

type DailyRollupFile = {
  generatedAt: string
  endpoint: string
  days: DailyRollup[]
}

type Col = "symbol" | "pythLazerId" | "changeType" | "status" | "changedFields"

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  went_live: "Went Live",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
}

const CHANGE_TYPE_VARIANTS: Record<
  ChangeType,
  "success" | "info" | "warning" | "error"
> = {
  went_live: "success",
  added: "info",
  changed: "warning",
  removed: "error",
}

const rawData = changelogData as DailyRollupFile
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function PriceFeedIdsProChangelog() {
  const [search, setSearch] = useState("")
  const [includeAllFieldDiffs, setIncludeAllFieldDiffs] = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(
    rawData.days[0]?.date ?? null,
  )
  const [pageByDay, setPageByDay] = useState<Record<string, number>>({})
  const [pageSizeByDay, setPageSizeByDay] = useState<Record<string, number>>({})

  const normalizedQuery = search.trim().toLowerCase()

  const filteredDays = useMemo(() => {
    return rawData.days.map((day) => {
      const visibleChanges = day.changes.filter((change) => {
        if (
          !includeAllFieldDiffs &&
          change.changeType !== "went_live" &&
          change.statusBefore === change.statusAfter
        ) {
          return false
        }

        if (normalizedQuery === "") return true

        const queryTarget =
          `${change.symbol} ${change.name} ${String(change.pythLazerId)}`.toLowerCase()
        return queryTarget.includes(normalizedQuery)
      })

      return { ...day, visibleChanges }
    })
  }, [includeAllFieldDiffs, normalizedQuery])

  const hasAnyVisibleData = filteredDays.some((day) => day.visibleChanges.length > 0)
  const hasRollupHistory = rawData.days.length > 0

  const columns: ColumnConfig<Col>[] = [
    { id: "symbol", name: "Symbol", isRowHeader: true },
    { id: "pythLazerId", name: "Pyth Pro ID" },
    { id: "changeType", name: "Change" },
    { id: "status", name: "Status" },
    { id: "changedFields", name: "Changed Fields" },
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <SearchInput
          label="Search changelog entries"
          placeholder="Search by symbol, name, or ID"
          value={search}
          onChange={setSearch}
        />
        <Switch
          isSelected={includeAllFieldDiffs}
          onChange={setIncludeAllFieldDiffs}
          className={styles.switch ?? ""}
        >
          Include all property changes
        </Switch>
      </div>

      {!hasRollupHistory ? (
        <NoResults
          icon={<Info />}
          header="No changelog entries yet"
          body={
            <p>
              The first snapshot has been recorded. Daily changelog entries will
              appear after the next UTC snapshot comparison.
            </p>
          }
          variant="info"
        />
      ) : null}

      {hasRollupHistory && !hasAnyVisibleData ? (
        <NoResults
          query={search}
          onClearSearch={() => {
            setSearch("")
          }}
        />
      ) : null}

      {hasRollupHistory && hasAnyVisibleData ? (
        <div className={styles.dayList}>
          {filteredDays.map((day) => {
            if (day.visibleChanges.length === 0) return null

            const isExpanded = expandedDay === day.date
            const page = pageByDay[day.date] ?? 1
            const pageSize = pageSizeByDay[day.date] ?? 10
            const numPages = Math.max(1, Math.ceil(day.visibleChanges.length / pageSize))
            const safePage = Math.min(page, numPages)
            const offset = (safePage - 1) * pageSize
            const pagedChanges = day.visibleChanges.slice(offset, offset + pageSize)

            const rows = pagedChanges.map((change) => ({
              id: `${day.date}-${change.pythLazerId}-${change.changeType}`,
              data: {
                symbol: change.symbol,
                pythLazerId: change.pythLazerId,
                changeType: (
                  <Badge variant={CHANGE_TYPE_VARIANTS[change.changeType]} size="xs">
                    {CHANGE_TYPE_LABELS[change.changeType]}
                  </Badge>
                ),
                status: formatStatus(change),
                changedFields: summarizeChangedFields(change.changedFields),
              },
            }))

            return (
              <Card
                key={day.date}
                nonInteractive
                title={formatDayLabel(day.date)}
                variant="secondary"
                className={styles.dayCard}
                toolbar={
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setExpandedDay((previous) => (previous === day.date ? null : day.date))
                    }}
                    afterIcon={isExpanded ? <CaretUp /> : <CaretDown />}
                  >
                    {isExpanded ? "Hide details" : "Show details"}
                  </Button>
                }
              >
                <div className={styles.badges}>
                  <Badge variant="success" style="outline" size="xs">
                    Went Live: {day.totals.went_live}
                  </Badge>
                  <Badge variant="info" style="outline" size="xs">
                    Added: {day.totals.added}
                  </Badge>
                  <Badge variant="warning" style="outline" size="xs">
                    Changed: {day.totals.changed}
                  </Badge>
                  <Badge variant="error" style="outline" size="xs">
                    Removed: {day.totals.removed}
                  </Badge>
                  <Badge variant="neutral" style="outline" size="xs">
                    Visible: {day.visibleChanges.length}
                  </Badge>
                </div>

                {isExpanded && (
                  <div className={styles.details}>
                    <Table<Col>
                      label={`Pyth Pro changelog for ${formatDayLabel(day.date)}`}
                      columns={columns}
                      rows={rows}
                      isLoading={false}
                      rounded
                      fill
                    />
                    <Paginator
                      numPages={numPages}
                      currentPage={safePage}
                      onPageChange={(nextPage: number) => {
                        setPageByDay((previous) => ({ ...previous, [day.date]: nextPage }))
                      }}
                      pageSize={pageSize}
                      onPageSizeChange={(nextSize: number) => {
                        setPageByDay((previous) => ({ ...previous, [day.date]: 1 }))
                        setPageSizeByDay((previous) => ({
                          ...previous,
                          [day.date]: nextSize,
                        }))
                      }}
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function formatDayLabel(day: string) {
  const parsed = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return `${day} (UTC)`
  return `${dayFormatter.format(parsed)} (UTC)`
}

function formatStatus(change: ChangeEntry) {
  if (change.statusBefore === change.statusAfter) return change.statusAfter ?? "-"
  return `${change.statusBefore ?? "-"} -> ${change.statusAfter ?? "-"}`
}

function summarizeChangedFields(changedFields: FieldDiff[]) {
  if (changedFields.length === 0) return "-"
  const topFields = changedFields.slice(0, 3).map((field) => field.path)
  if (changedFields.length <= 3) return topFields.join(", ")
  return `${topFields.join(", ")}, +${String(changedFields.length - 3)} more`
}
