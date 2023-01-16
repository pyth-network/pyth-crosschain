import React from 'react'

interface LoadbarProps {
  theme?: string
  width?: string | null
}

const Loadbar: React.FC<LoadbarProps> = ({ theme, width }) => {
  let color = 'bg-dark-300'
  if (theme == 'light') {
    color = 'bg-beige-300'
  }
  return (
    <div className=" animate-pulse">
      {width ? (
        <div className="w-full">
          <div className={`h-3 ${color} w-${width} mb-2.5`}></div>
        </div>
      ) : (
        <div className="w-full">
          <div className={`h-3 ${color} mb-2.5 w-48`}></div>
          <div className={`h-3 ${color} mb-2.5 max-w-[480px]`}></div>
          <div className={`h-3 ${color} mb-2.5`}></div>
          <div className={`h-3 ${color} mb-2.5 max-w-[840px]`}></div>
          <div className={`h-3 ${color} mb-2.5 max-w-[760px]`}></div>
          <div className={`h-3 ${color} max-w-[560px]`}></div>
        </div>
      )}

      <span className="sr-only">Loading...</span>
    </div>
  )
}

export default Loadbar
