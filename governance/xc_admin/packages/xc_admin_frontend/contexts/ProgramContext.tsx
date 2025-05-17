import { createContext, useContext, useState, ReactNode } from 'react'
import { ProgramType } from '@pythnetwork/xc-admin-common'

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
  // Local state for program type
  const [programType, setProgramTypeState] = useState<ProgramType>(
    ProgramType.PYTH_CORE
  )

  // Local state for program support
  const [isProgramSupported] = useState(true)

  /**
   * Update program type
   */
  const setProgramType = (type: ProgramType) => {
    setProgramTypeState(type)
  }

  // TODO: Add effect to check if the selected program is supported on the current cluster
  // This will be implemented when we have the adapter implementations

  const value = {
    programType,
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
