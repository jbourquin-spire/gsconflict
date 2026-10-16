import { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ConflictGantt } from '@/components/conflict-gantt'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { findConflicts } from '@/lib/conflicts'
import { formatDuration, formatUtc } from '@/lib/format'
import type { Transit } from '@/lib/types'
import { cn } from '@/lib/utils'

export const TRANSIT_COLUMN_COUNT = 7

function TransitCells({ transit }: { transit: Transit }) {
  return (
    <>
      <TableCell>{formatUtc(transit.startMs)}</TableCell>
      <TableCell>{formatUtc(transit.stopMs)}</TableCell>
      <TableCell>{formatDuration(transit.durationS)}</TableCell>
      <TableCell>{transit.groundStation}</TableCell>
      <TableCell>{transit.satellite}</TableCell>
      <TableCell>{transit.noradId}</TableCell>
    </>
  )
}

interface TransitRowProps {
  transit: Transit
  /** All transits at the same ground station, used to look up conflicts. */
  stationTransits: Transit[]
  /** Applies the alternate (striped) background colour. */
  striped?: boolean
  expanded: boolean
  onToggle: () => void
}

/** A transit row. Clicking the conflict count expands a Gantt chart of the conflicting transits beneath it. */
export function TransitRow({
  transit,
  stationTransits,
  striped = false,
  expanded,
  onToggle,
}: TransitRowProps) {
  const conflicts = useMemo(
    () => (expanded ? findConflicts(transit, stationTransits) : []),
    [expanded, transit, stationTransits],
  )

  return (
    <>
      <TableRow
        data-state={expanded ? 'selected' : undefined}
        className={cn(striped && 'bg-muted/70 hover:bg-muted/90')}
      >
        <TransitCells transit={transit} />
        <TableCell className="text-center">
          {transit.conflicts > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 font-mono tabular-nums"
              aria-expanded={expanded}
              aria-label={`${transit.conflicts} conflicting transit${
                transit.conflicts === 1 ? '' : 's'
              }, ${expanded ? 'hide' : 'show'}`}
              onClick={onToggle}
            >
              {expanded ? <ChevronDown /> : <ChevronRight />}
              {transit.conflicts}
            </Button>
          ) : (
            <span className="px-2 text-muted-foreground" aria-label="No conflicts">
              --
            </span>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={TRANSIT_COLUMN_COUNT} className="bg-background/60 px-4">
            <ConflictGantt transit={transit} conflicts={conflicts} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
