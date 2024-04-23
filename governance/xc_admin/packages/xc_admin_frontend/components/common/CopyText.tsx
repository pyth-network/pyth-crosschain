import copy from 'copy-to-clipboard'
import CopyIcon from '@images/icons/copy.inline.svg'

const CopyText: React.FC<{
  text: string
}> = ({ text }) => {
  return (
    <div
      className="-ml-1 inline-flex cursor-pointer items-center break-all px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
      onClick={() => {
        copy(text)
      }}
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
