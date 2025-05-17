import { ProgramType, PROGRAM_TYPE_NAMES } from '@pythnetwork/xc-admin-common'
import { useProgramContext } from '../contexts/ProgramContext'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

const Arrow = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="10"
    height="6"
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 1L5 5L9 1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Component that allows users to switch between different Pyth programs
 * (Core, Lazer, etc.)
 */
const ProgramSwitch = ({ light = false }: { light?: boolean }) => {
  const { programType, setProgramType } = useProgramContext()

  // Convert enum to array of options
  const programOptions = Object.entries(PROGRAM_TYPE_NAMES).map(
    ([value, label]) => ({
      value: Number(value) as ProgramType,
      label,
    })
  )

  return (
    <Menu as="div" className="relative z-[5] block w-[180px] text-left">
      {({ open }) => (
        <>
          <Menu.Button
            className={`inline-flex w-full items-center justify-between py-3 px-6 text-sm outline-0 ${
              light ? 'bg-beige2' : 'bg-darkGray2'
            }`}
          >
            <span className="mr-3">
              {programOptions.find((option) => option.value === programType)
                ?.label ?? PROGRAM_TYPE_NAMES[programType]}
            </span>
            <Arrow className={`${open ? 'rotate-180' : ''}`} />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-full origin-top-right">
              {programOptions.map((option) => (
                <Menu.Item key={option.value}>
                  {({ active }) => (
                    <button
                      className={`block w-full py-3 px-6 text-left text-sm ${
                        light
                          ? active
                            ? 'bg-beige3'
                            : 'bg-beige2'
                          : active
                            ? 'bg-darkGray2'
                            : 'bg-darkGray'
                      }`}
                      onClick={() => setProgramType(option.value)}
                    >
                      {option.label}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  )
}

export default ProgramSwitch
