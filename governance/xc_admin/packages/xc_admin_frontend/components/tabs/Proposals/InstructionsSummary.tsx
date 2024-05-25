import { Listbox, Transition } from '@headlessui/react'
import { PythCluster } from '@pythnetwork/client'
import { MultisigInstruction } from '@pythnetwork/xc-admin-common'
import { getInstructionsSummary } from './utils'
import { getMappingCluster } from '../../InstructionViews/utils'
import CopyText from '../../common/CopyText'
import Arrow from '@images/icons/down.inline.svg'
import { Fragment, useState, useMemo, useContext } from 'react'
import { usePythContext } from '../../../contexts/PythContext'
import { ClusterContext } from '../../../contexts/ClusterContext'

export const InstructionsSummary = ({
  instructions,
  cluster,
}: {
  instructions: MultisigInstruction[]
  cluster: PythCluster
}) => (
  <div className="space-y-4">
    {getInstructionsSummary({ instructions, cluster }).map((instruction) => (
      <SummaryItem instruction={instruction} key={instruction.name} />
    ))}
  </div>
)

const SummaryItem = ({
  instruction,
}: {
  instruction: ReturnType<typeof getInstructionsSummary>[number]
}) => {
  switch (instruction.name) {
    case 'addPublisher':
    case 'delPublisher': {
      return (
        <div className="grid grid-cols-4 justify-between">
          <div className="col-span-4 lg:col-span-1">
            {instruction.name}: {instruction.count}
          </div>
          <AddRemovePublisherDetails
            isAdd={instruction.name === 'addPublisher'}
            summaries={
              instruction.summaries as AddRemovePublisherDetailsProps['summaries']
            }
          />
        </div>
      )
    }
    default: {
      return (
        <div>
          {instruction.name}: {instruction.count}
        </div>
      )
    }
  }
}

type AddRemovePublisherDetailsProps = {
  isAdd: boolean
  summaries: {
    readonly priceAccount: string
    readonly pub: string
  }[]
}

const AddRemovePublisherDetails = ({
  isAdd,
  summaries,
}: AddRemovePublisherDetailsProps) => {
  const { cluster } = useContext(ClusterContext)
  const { priceAccountKeyToSymbolMapping, publisherKeyToNameMapping } =
    usePythContext()
  const publisherKeyToName =
    publisherKeyToNameMapping[getMappingCluster(cluster)]
  const [groupBy, setGroupBy] = useState<'publisher' | 'price account'>(
    'publisher'
  )
  const grouped = useMemo(
    () =>
      Object.groupBy(summaries, (summary) =>
        groupBy === 'publisher' ? summary.pub : summary.priceAccount
      ),
    [groupBy, summaries]
  )

  return (
    <div className="col-span-4 mt-2 bg-[#444157] p-4 lg:col-span-3 lg:mt-0">
      <div className="flex flex-row gap-4 items-center pb-4 mb-4 border-b border-light/50 justify-end">
        <div className="font-semibold">Group by</div>
        <Select
          items={['publisher', 'price account']}
          value={groupBy}
          onChange={setGroupBy}
        />
      </div>
      <div className="base16 flex justify-between pt-2 pb-6 font-semibold opacity-60">
        <div>{groupBy === 'publisher' ? 'Publisher' : 'Price Account'}</div>
        <div>
          {groupBy === 'publisher'
            ? isAdd
              ? 'Added To'
              : 'Removed From'
            : `${isAdd ? 'Added' : 'Removed'} Publishers`}
        </div>
      </div>
      {Object.entries(grouped).map(([groupKey, summaries = []]) => (
        <>
          <div
            key={groupKey}
            className="flex justify-between border-t border-beige-300 py-3"
          >
            <div>
              <KeyAndName
                mapping={
                  groupBy === 'publisher'
                    ? publisherKeyToName
                    : priceAccountKeyToSymbolMapping
                }
              >
                {groupKey}
              </KeyAndName>
            </div>
            <ul className="flex flex-col gap-2">
              {summaries.map((summary, index) => (
                <li key={index}>
                  <KeyAndName
                    mapping={
                      groupBy === 'publisher'
                        ? priceAccountKeyToSymbolMapping
                        : publisherKeyToName
                    }
                  >
                    {groupBy === 'publisher'
                      ? summary.priceAccount
                      : summary.pub}
                  </KeyAndName>
                </li>
              ))}
            </ul>
          </div>
        </>
      ))}
    </div>
  )
}

const KeyAndName = ({
  mapping,
  children,
}: {
  mapping: { [key: string]: string }
  children: string
}) => {
  const name = useMemo(() => mapping[children], [mapping, children])

  return (
    <div>
      <CopyText text={children} />
      {name && <div className="ml-4 text-xs opacity-80"> &#10551; {name} </div>}
    </div>
  )
}

type SelectProps<T extends string> = {
  items: T[]
  value: T
  onChange: (newValue: T) => void
}

const Select = <T extends string>({
  items,
  value,
  onChange,
}: SelectProps<T>) => (
  <Listbox
    as="div"
    className="relative z-[3] block w-[180px] text-left"
    value={value}
    onChange={onChange}
  >
    {({ open }) => (
      <>
        <Listbox.Button className="inline-flex w-full items-center justify-between py-3 px-6 text-sm outline-0 bg-light/20">
          <span className="mr-3">{value}</span>
          <Arrow className={`${open && 'rotate-180'}`} />
        </Listbox.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Listbox.Options className="absolute right-0 mt-2 w-full origin-top-right">
            {items.map((item) => (
              <Listbox.Option
                key={item}
                value={item}
                className="block w-full py-3 px-6 text-left text-sm bg-darkGray hover:bg-darkGray2 cursor-pointer"
              >
                {item}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </>
    )}
  </Listbox>
)
