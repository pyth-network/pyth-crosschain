/* eslint-disable react/prop-types */
import CopyIcon from '@images/icons/copy.inline.svg'
import copy from 'copy-to-clipboard'

const CopyText: React.FC<{
  text: string
}> = ({ text }) => {
  return (
    <div
      aria-label="copy text"
      className="-ml-1 inline-flex cursor-pointer items-center break-all px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
      onClick={() => {
        copy(text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') copy(text)
      }}
      role="button"
      tabIndex={0}
    >
      <span className="mr-2 hidden xl:block">{text}</span>
      <span className="mr-2 xl:hidden">
        {text.slice(0, 6) + '...' + text.slice(-6)}
      </span>{' '}
      <CopyIcon className="shrink-0" />
    </div>
  )
}

export default CopyText
