import {
  Field,
  Label,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Transition,
} from '@headlessui/react'
import type { ComponentProps } from 'react'
import Arrow from '@images/icons/down.inline.svg'
import { Fragment } from 'react'

type OwnProps<T> = {
  label: string
  options: readonly T[]
  value: T
  onChange: (newValue: T) => void
}

type Props<T> = Omit<ComponentProps<typeof Listbox>, keyof OwnProps<T>> &
  OwnProps<T>

export const Select = <T extends string>({
  options,
  label,
  ...props
}: Props<T>) => (
  <Field className="flex flex-col gap-1">
    <Label>{label}</Label>
    <Listbox as="div" className="relative block w-[180px] text-left" {...props}>
      {({ open }) => (
        <>
          <ListboxButton className="inline-flex w-full items-center justify-between bg-darkGray2 py-3 px-6 text-sm outline-0">
            <span className="mr-3">{props.value}</span>
            <Arrow className={`${open && 'rotate-180'}`} />
          </ListboxButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <ListboxOptions className="absolute right-0 mt-2 w-full origin-top-right z-10">
              {options.map((option) => (
                <ListboxOption
                  key={option}
                  value={option}
                  className="block w-full bg-darkGray py-3 px-6 text-left text-sm hover:bg-darkGray2 cursor-pointer"
                >
                  {option}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </>
      )}
    </Listbox>
  </Field>
)
