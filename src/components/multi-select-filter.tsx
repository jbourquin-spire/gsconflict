import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface MultiSelectFilterProps {
  /** Column title shown on the trigger. */
  label: string
  /** Every value that can be selected. */
  options: string[]
  /** The selected values, or `null` for "All" (no filtering). */
  selected: Set<string> | null
  onChange: (selected: Set<string> | null) => void
}

function summarise(selected: Set<string> | null): string {
  if (selected === null) return 'All'
  if (selected.size === 1) return [...selected][0]
  return `${selected.size} selected`
}

/**
 * A searchable multi-select dropdown used as a table column filter. "All"
 * means no filtering. Choosing a value while "All" is active selects just that
 * value; further choices are added to (or removed from) the selection, and
 * emptying it — or selecting everything — goes back to "All".
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  function toggle(option: string) {
    if (selected === null) {
      onChange(new Set([option]))
      return
    }
    const next = new Set(selected)
    if (!next.delete(option)) next.add(option)
    onChange(next.size === 0 || next.size === options.length ? null : next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 px-2 font-medium"
          aria-label={`Filter by ${label.toLowerCase()}: ${summarise(selected)}`}
        >
          {label}
          <span
            className={cn(
              'max-w-28 truncate rounded bg-secondary px-1.5 py-0.5 text-xs font-normal',
              selected === null ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {summarise(selected)}
          </span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="All" onSelect={() => onChange(null)}>
                <Check
                  className={cn(selected === null ? 'opacity-100' : 'opacity-0')}
                />
                All
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => toggle(option)}
                >
                  <Check
                    className={cn(
                      selected?.has(option) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
