import { useState } from 'react';
import { ShiftPattern, ShiftAllocation, Profile } from '../types/app';
import { useRoom } from '../data/room';
import { deleteShiftAllocation, deleteShiftPattern, useRota, calculateScheduleStatus } from '../data/rota';
import { useUser } from '../data/auth';
import { EmojiHappyIcon, EmojiSadIcon } from '@heroicons/react/outline';
import { useCombobox, UseComboboxProps } from 'downshift';
import { Transition } from '@headlessui/react';
import { ShowFor } from './Elements';
import cronRenderer from 'cronstrue'
import later from '@breejs/later'
import { format } from 'date-fns-tz';

export function ShiftPatterns () {
  const rota = useRota()

  return (
    <div className='space-y-5'>
      {rota.shiftPatterns?.map((shiftPattern, index) => {
        return (
          <ShiftPatternAllocations key={shiftPattern.id} shiftPattern={shiftPattern} />
        )
      })}
    </div>
  )
}

export function ShiftPatternAllocations ({ shiftPattern }: { shiftPattern: ShiftPattern }) {
  const { profile } = useUser()
  const rota = useRota()

  const allocatedSlots = rota.shiftAllocations
    .filter(({ shiftPatternId }) => shiftPatternId === shiftPattern.id)
    .sort((a, b) => a.id.localeCompare(b.id))
    
  const { notEnough, justRight, tooMany } = calculateScheduleStatus(shiftPattern, allocatedSlots)

  return (
    <div key={shiftPattern.id} className=''>
      <h3 className='text-2xl font-bold text-adhdPurple mb-2'>{shiftPattern.name}</h3>
      {shiftPattern.cron && <section className='space-y-2 mb-4'>
        <p>Sessions run at {cronRenderer.toString(shiftPattern.cron, { use24HourTimeFormat: false }).replace(/^At/, '')}. Next session is <b>{format(later.schedule(later.parse.cron(shiftPattern.cron)).next(1) as Date, "PP")}.</b></p>
      </section>}
      <div className={`font-bold uppercase flex justify-between w-full text-sm ${
        notEnough ? 'text-red-500' : tooMany ? 'text-yellow-600' : 'text-green-500'
      }`}>
        <span>{allocatedSlots.length} / {shiftPattern.required_people} leader slot{shiftPattern.required_people > 1 && 's'} filled</span>
        <span>{justRight ? <EmojiHappyIcon className='w-[25px] h-[25px]' /> : <EmojiSadIcon className='w-[25px] h-[25px]' />}</span>
      </div>
      <div className='space-y-2 my-2'>
        {/* {allocatedSlots.map((shiftAllocation, i) => (
          <div key={i} className='shadow-sm rounded-lg p-3 hover:bg-gray-50 transition'>
            {shiftAllocation.userId}
          </div>
        ))} */}
        {new Array(Math.max(shiftPattern.required_people, allocatedSlots.length)).fill(0).map((_, i) => {
          return (
            <ShiftAllocationEditor
              key={(allocatedSlots[i]?.id || i.toString()) + JSON.stringify(rota.roomLeaders)}
              shiftAllocation={allocatedSlots[i]}
              shiftPattern={shiftPattern}
              options={rota.roomLeaders}
            />
          )
        })}
      </div>
      {profile?.canManageShifts && <div className='button' onClick={() => deleteShiftPattern(shiftPattern.id)}>Delete</div>}
    </div>
  )
}

/*
<div key={i} className='border border-dashed border-gray-400 rounded-lg p-3 hover:bg-gray-50 transition'>
  Fill vacant slot {allocatedSlots.length + i + 1}
</div>
*/

export const itemToString = (o: Profile | null) => o ? o.firstName ? `${o.firstName?.trim()} ${o.lastName?.trim() || ''}` : o.email : "Vacant slot"

function ShiftAllocationEditor(
  { shiftPattern, options, shiftAllocation }:
  { shiftPattern: ShiftPattern, options: Profile[], shiftAllocation?: ShiftAllocation }
) {
  const rota = useRota()
  const [inputItems, setInputItems] = useState<Profile[]>(options)
  const [savedDataState, setDataState] = useState<null | 'loading' | 'saved' | 'error'>(null)

  const initialSelectedItem = options.find(o => o.id === shiftAllocation?.profileId)

  const comboProps: UseComboboxProps<Profile> = {
    initialSelectedItem,
    items: inputItems,
    itemToString,
    onInputValueChange: ({ inputValue }) => {
      setInputItems(
        options
          .filter(profile => {
            const inShiftPatternAlready = !!rota.shiftAllocations.find(sa =>
              sa.shiftPatternId === shiftPattern.id &&
              sa.profileId === profile.id
            )
            if (inShiftPatternAlready) return false
            const matchesInputValue = (
              profile.email?.toLowerCase().startsWith(inputValue?.toLowerCase() || '') ||
              profile.firstName?.toLowerCase().startsWith(inputValue?.toLowerCase() || '') ||
              profile.lastName?.toLowerCase().startsWith(inputValue?.toLowerCase() || '')
            )
            return matchesInputValue
          }),
      )
    },
    onSelectedItemChange: async ({ selectedItem: profile }) => {
      if (profile) {
        try {
          setDataState('loading')
          await rota.createShiftAllocation({
            shiftPatternId: shiftPattern.id,
            profileId: profile.id
          })
          setDataState('saved')
        } catch (e) {
          setDataState('error')
        }
      }
    }
  }

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    highlightedIndex,
    getItemProps,
    reset
  } = useCombobox<Profile>(comboProps)

  function deleteAllocation () {
    reset()
    if (shiftAllocation) {
      deleteShiftAllocation(shiftAllocation.id)
    }
  }

  return (
    <div className='relative'>
      <div className='flex flex-row justify-between border border-dashed border-gray-400 rounded-lg p-3 hover:bg-gray-50 transition' {...getComboboxProps()}>
        <input {...getInputProps()} placeholder='Fill vacant slot' className='border-none bg-gray-50 rounded-md' />
        <button
          type="button"
          {...getToggleButtonProps()}
          aria-label="Show available staff"
        >
          &#8595;
        </button>
        <ShowFor seconds={3} key={savedDataState}>
          {savedDataState && <span className='bg-adhdBlue rounded-lg p-1 text-sm uppercase'>{savedDataState}</span>}
        </ShowFor>
        {shiftAllocation && <div onClick={deleteAllocation} className='button p-1 uppercase text-sm'>Clear</div>}
      </div>
      <Transition
        appear={true}
        show={isOpen}
        enter="transition-opacity duration-75"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <ul className='border border-gray-400 rounded-lg p-3 shadow-md absolute top-[100%] z-50 w-full bg-white' {...getMenuProps()}>
          {isOpen &&
            inputItems.map((item, index) => (
              <li
                style={
                  highlightedIndex === index
                    ? { backgroundColor: '#bde4ff' }
                    : {}
                }
                key={`${item}${index}`}
                {...getItemProps({ item, index })}
              >
                {itemToString(item)}
              </li>
            ))}
        </ul>
      </Transition>
    </div>
  )
}

export function CreateShiftPattern () {
  const { room } = useRoom()
  const rota = useRota()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!room) throw new Error("No room was available")
    rota.createShiftPattern({
      // @ts-ignore
      name: event.target.name.value,
      // @ts-ignore
      required_people: event.target.required_people.value,
      roomId: room.id
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="shadow overflow-hidden sm:rounded-md">
        <div className="p-4 sm:p-5 bg-white">
          <h3 className='text-2xl mb-4 text-left'>Add a shift pattern</h3>
          <div className="grid grid-flow-row gap-2">
            <div className="col-span-6 sm:col-span-3">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name of shift pattern</label>
              <input required type="text" name="name" id="name" className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
            </div>

            <div className="col-span-6 sm:col-span-3">
              <label htmlFor="required_people" className="block text-sm font-medium text-gray-700">Number of required people</label>
              <input required type="number" min={1} max={100} defaultValue={2} name="required_people" id="required_people" className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
            </div>
          </div>
        </div>
        <div className="px-4 py-3 bg-gray-50 text-right sm:px-5">
          <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Create shift pattern
          </button>
        </div>
      </div>
    </form>
  )
}