import { createContext, useContext, useState, ReactNode } from 'react'
import { ProgramType } from '@pythnetwork/xc-admin-common'
import { useQueryState, parseAsStringLiteral } from 'nuqs'

/**
 * Interface defining the shape of the Program context
 */
interface ProgramContextType {
  /**
   * Currently selected program type
   */
  programType: ProgramType

  /**
   * Function to set the current program type
   */
  setProgramType: (type: ProgramType) => void

  /**
   * Whether the selected program is supported on the current cluster
   */
  isProgramSupported: boolean
}

/**
 * Default context values
 */
const defaultContext: ProgramContextType = {
  programType: ProgramType.PYTH_CORE,
  setProgramType: () => undefined,
  isProgramSupported: true,
}

/**
 * Context for managing the currently selected Pyth program (Core, Lazer, etc.)
 */
const ProgramContext = createContext<ProgramContextType>(defaultContext)

/**
 * Provider component for the Program context
 */
export const ProgramProvider = ({ children }: { children: ReactNode }) => {
  // Use URL query parameter to persist program selection across page reloads
  const [programTypeParam, setProgramTypeParam] = useQueryState(
    'program',
    parseAsStringLiteral(
      Object.values(ProgramType) as readonly string[]
    ).withDefault(ProgramType.PYTH_CORE)
  )

  // Local state for program support
  const [isProgramSupported] = useState(true)

  /**
   * Update both the URL parameter and context state
   */
  const setProgramType = (type: ProgramType) => {
    setProgramTypeParam(type)
  }

  // TODO: Add effect to check if the selected program is supported on the current cluster
  // This will be implemented when we have the adapter implementations

  const value = {
    programType: programTypeParam as ProgramType,
    setProgramType,
    isProgramSupported,
  }

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  )
}

/**
 * Hook for accessing the Program context
 * @returns The Program context values
 */
export const useProgramContext = () => useContext(ProgramContext)
