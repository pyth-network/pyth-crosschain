import copy from 'copy-to-clipboard'
import CopyIcon from '../../images/icons/copy.inline.svg'

const CopyPubkey: React.FC<{
  pubkey: string
}> = ({ pubkey }) => {
  return (
    <div
      className="-ml-1 inline-flex cursor-pointer items-center px-1 hover:bg-dark hover:text-white active:bg-darkGray3"
      onClick={() => {
        copy(pubkey)
      }}
    >
      <span className="mr-2 hidden xl:block">{pubkey}</span>
      <span className="mr-2 xl:hidden">
        {pubkey.slice(0, 6) + '...' + pubkey.slice(-6)}
      </span>{' '}
      <CopyIcon className="shrink-0" />
    </div>
  )
}

export default CopyPubkey
