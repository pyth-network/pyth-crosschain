import { createContext, useMemo, useState } from 'react'

export const DEFAULT_STATUS_FILTER = 'all'

export const StatusFilterContext = createContext<{
  statusFilter: string
  setStatusFilter: any
}>({
  statusFilter: DEFAULT_STATUS_FILTER,
  setStatusFilter: {},
})

export const StatusFilterProvider = (props: any) => {
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_STATUS_FILTER)
  const contextValue = useMemo(
    () => ({
      statusFilter,
      setStatusFilter: (statusFilter: string) => {
        setStatusFilter(statusFilter)
      },
    }),
    [statusFilter]
  )
  return <StatusFilterContext.Provider {...props} value={contextValue} />
}
