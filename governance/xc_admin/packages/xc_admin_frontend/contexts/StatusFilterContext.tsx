import { ReactNode, createContext, useMemo, useState } from 'react'
import { ProposalStatus } from '../components/tabs/Proposals/utils'

export const DEFAULT_STATUS_FILTER = 'all'

export type ProposalStatusFilter = 'all' | ProposalStatus

export const StatusFilterContext = createContext<{
  statusFilter: ProposalStatusFilter
  setStatusFilter: (_statusFilter: ProposalStatusFilter) => void
}>({
  statusFilter: DEFAULT_STATUS_FILTER,
  setStatusFilter: () => {},
})

export const StatusFilterProvider = ({ children }: { children: ReactNode }) => {
  const [statusFilter, setStatusFilter] = useState<ProposalStatusFilter>(
    DEFAULT_STATUS_FILTER
  )
  const contextValue = useMemo(
    () => ({
      statusFilter,
      setStatusFilter: (statusFilter: ProposalStatusFilter) => {
        setStatusFilter(statusFilter)
      },
    }),
    [statusFilter]
  )
  return (
    <StatusFilterContext.Provider value={contextValue}>
      {children}
    </StatusFilterContext.Provider>
  )
}
