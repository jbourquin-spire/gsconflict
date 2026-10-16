import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ganttColor } from '@/lib/colors'
import { formatDuration, formatUtc, formatUtcTime } from '@/lib/format'
import type { Transit } from '@/lib/types'
import { cn } from '@/lib/utils'

const TICK_COUNT = 5

interface ConflictGanttProps {
  /** The transit whose conflicts are shown (top row). */
  transit: Transit
  /** Transits that intersect `transit`, one chart row each. */
  conflicts: Transit[]
}

interface BarProps {
  transit: Transit
  /** The current transit; set on conflict bars to show the overlap in the popup. */
  reference?: Transit
  rangeStart: number
  rangeLength: number
  /** Fill color of the bar. */
  color: string
}

function Bar({
  transit,
  reference,
  rangeStart,
  rangeLength,
  color,
}: BarProps) {
  const left = ((transit.startMs - rangeStart) / rangeLength) * 100
  const width = ((transit.stopMs - transit.startMs) / rangeLength) * 100

  const overlapStart = reference
    ? Math.max(transit.startMs, reference.startMs)
    : 0
  const overlapStop = reference ? Math.min(transit.stopMs, reference.stopMs) : 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          role="img"
          aria-label={`${transit.satellite}, ${formatUtcTime(
            transit.startMs,
          )} to ${formatUtcTime(transit.stopMs)} UTC`}
          className="absolute top-1 bottom-1 min-w-0.5 rounded-[3px] outline-none transition-[filter] hover:brightness-125 focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </TooltipTrigger>
      <TooltipContent className="grid gap-0.5 text-left font-mono text-muted-foreground">
        <div className="font-mono font-semibold text-foreground">{transit.satellite}</div>
        <div>NORAD ID: {transit.noradId || 'n/a'}</div>
        <div>Ground station: {transit.groundStation}</div>
        <div>Start: {formatUtc(transit.startMs)} UTC</div>
        <div>Stop: {formatUtc(transit.stopMs)} UTC</div>
        <div>Duration: {formatDuration(transit.durationS)}</div>
        {reference && (
          <div className="mt-1 border-t border-border pt-1">
            Overlap: {formatDuration((overlapStop - overlapStart) / 1000)} (
            {formatUtcTime(overlapStart)}–{formatUtcTime(overlapStop)})
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Gantt chart of a transit and the transits that conflict with it. The top row
 * is the transit itself; every following row is one conflicting transit.
 */
export function ConflictGantt({ transit, conflicts }: ConflictGanttProps) {
  const rows = [transit, ...conflicts]
  const rangeStart = Math.min(...rows.map((row) => row.startMs))
  const rangeStop = Math.max(...rows.map((row) => row.stopMs))
  const rangeLength = Math.max(rangeStop - rangeStart, 1)

  const referenceLeft = ((transit.startMs - rangeStart) / rangeLength) * 100
  const referenceWidth =
    ((transit.stopMs - transit.startMs) / rangeLength) * 100

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const fraction = i / (TICK_COUNT - 1)
    return { fraction, label: formatUtcTime(rangeStart + fraction * rangeLength) }
  })

  return (
    <TooltipProvider>
      <div className="grid gap-1 py-3" aria-label="Conflict timeline">
        <div className="flex">
          <div className="w-56 shrink-0 pr-3 text-xs text-heading">
            Time (UTC)
          </div>
          <div className="relative h-4 flex-1 font-mono text-[11px] text-muted-foreground">
            {ticks.map(({ fraction, label }) => (
              <span
                key={fraction}
                className={cn(
                  'absolute tabular-nums',
                  fraction === 0 && 'left-0',
                  fraction === 1 && 'right-0',
                  fraction > 0 && fraction < 1 && '-translate-x-1/2',
                )}
                style={
                  fraction > 0 && fraction < 1
                    ? { left: `${fraction * 100}%` }
                    : undefined
                }
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex">
          <div className="w-56 shrink-0">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  'flex h-8 items-center pr-3 font-mono text-xs',
                  index === 0
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground',
                )}
                title={row.satellite}
              >
                <span
                  className="mr-2 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ganttColor(index) }}
                  aria-hidden
                />
                <span className="truncate">{row.satellite}</span>
              </div>
            ))}
          </div>

          <div className="relative flex-1 rounded-md border bg-background/70">
            {/* Vertical guides for the tick positions */}
            {ticks.slice(1, -1).map(({ fraction }) => (
              <div
                key={fraction}
                className="absolute inset-y-0 border-l border-dashed border-border/80"
                style={{ left: `${fraction * 100}%` }}
              />
            ))}
            {/* Band marking the current transit's time span */}
            <div
              className="absolute inset-y-0 bg-success/[0.07] ring-1 ring-inset ring-success/15"
              style={{ left: `${referenceLeft}%`, width: `${referenceWidth}%` }}
            />
            {rows.map((row, index) => (
              <div key={row.id} className="relative h-8">
                <Bar
                  transit={row}
                  reference={index === 0 ? undefined : transit}
                  rangeStart={rangeStart}
                  rangeLength={rangeLength}
                  color={ganttColor(index)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
