import React, { createContext, useState, ReactNode } from 'react'

export type LazerEnv = 'production' | 'staging'

export const DEFAULT_LAZER_ENV: LazerEnv = 'production'

interface LazerEnvContextType {
  lazerEnv: LazerEnv
  setLazerEnv: (env: LazerEnv) => void
}

export const LazerEnvContext = createContext<LazerEnvContextType>({
  lazerEnv: DEFAULT_LAZER_ENV,
  setLazerEnv: () => {
    // Default no-op function
  },
})

interface LazerEnvProviderProps {
  children: ReactNode
}

export const LazerEnvProvider: React.FC<LazerEnvProviderProps> = ({
  children,
}) => {
  const [lazerEnv, setLazerEnv] = useState<LazerEnv>(DEFAULT_LAZER_ENV)

  return (
    <LazerEnvContext.Provider value={{ lazerEnv, setLazerEnv }}>
      {children}
    </LazerEnvContext.Provider>
  )
}
