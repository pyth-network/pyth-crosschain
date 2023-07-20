export const SignerTag = () => {
  return (
    <div className="flex max-h-[22px] max-w-[74px] items-center justify-center rounded-full bg-[#605D72] py-1 px-2 text-xs">
      Signer
    </div>
  )
}

export const WritableTag = () => {
  return (
    <div className="flex max-h-[22px] max-w-[74px] items-center justify-center rounded-full bg-offPurple py-1 px-2 text-xs">
      Writable
    </div>
  )
}

export const ParsedAccountPubkeyRow = ({
  mapping,
  title,
  pubkey,
}: {
  mapping: { [key: string]: string }
  title: string
  pubkey: string
}) => {
  return (
    <div className="flex justify-between pb-3">
      <div className="max-w-[80px] break-words sm:max-w-none sm:break-normal">
        &#10551; {title}
      </div>
      <div className="space-y-2 sm:flex sm:space-x-2">{mapping[pubkey]}</div>
    </div>
  )
}
