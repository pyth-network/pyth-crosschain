import React from 'react'

interface PythLazerProps {
  proposerServerUrl: string // kept for consistency with PythCore interface
}

const PythLazer = ({
  proposerServerUrl: _proposerServerUrl,
}: PythLazerProps) => {
  return (
    <div className="relative p-10">
      <div className="text-center">
        <div className="mb-6 flex flex-col items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mb-4 h-16 w-16 text-amber-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <h2 className="text-xl font-semibold">
            Pyth Lazer is not supported yet
          </h2>
        </div>
        <p className="text-md mb-4 text-gray-400">
          The Pyth Lazer program integration is currently under development.
        </p>
        <p className="text-md mb-8 text-gray-400">
          Please check back later or switch to Pyth Core using the program
          selector above.
        </p>
      </div>
    </div>
  )
}

export default PythLazer
