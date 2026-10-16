import { satelliteTransits, TimestampFormat } from '@nsat/jspredict'
import { countConflicts } from '@/lib/conflicts'
import type { Transit, WorkerJob, WorkerMessage } from '@/lib/types'

/**
 * satelliteTransits clips passes to the search window, so a pass already in
 * progress at the window start would report the window start as its start time
 * (and the same for a pass still in progress at the end). To get true AOS/LOS
 * times, search a padded window and keep every pass that overlaps the requested
 * one. LEO passes last well under an hour.
 */
const SEARCH_PADDING_MS = 60 * 60 * 1000

function post(message: WorkerMessage) {
  self.postMessage(message)
}

// Each message is a job: calculate the transits of every satellite over a
// single ground station. A worker handles jobs one after another.
self.onmessage = (event: MessageEvent<WorkerJob>) => {
  const { satellites, groundStation, minElevation, startMs, stopMs } =
    event.data

  const observer = {
    geo: {
      latitude: groundStation.latitude,
      longitude: groundStation.longitude,
      height: groundStation.heightKm,
    },
  }
  const transits: Transit[] = []
  const errors = new Set<string>()

  for (const satellite of satellites) {
    try {
      const passes = satelliteTransits(
        satellite.elements,
        startMs - SEARCH_PADDING_MS,
        stopMs + SEARCH_PADDING_MS,
        observer,
        minElevation,
        { timestampFormat: TimestampFormat.Unix },
      )
      for (const pass of passes) {
        const start = Number(pass.start)
        const stop = Number(pass.stop)
        if (stop <= startMs || start >= stopMs) continue
        transits.push({
          id: `${satellite.id}|${groundStation.name}|${start}`,
          startMs: start,
          stopMs: stop,
          durationS: pass.duration,
          groundStation: groundStation.name,
          satellite: satellite.name,
          noradId: satellite.noradId,
          conflicts: 0,
        })
      }
    } catch (error) {
      errors.add(
        `${satellite.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    post({ type: 'progress', done: 1 })
  }

  // All of this station's transits are known here, so count conflicts now.
  const conflictCounts = countConflicts(transits)
  transits.forEach((transit, index) => {
    transit.conflicts = conflictCounts[index]
  })

  post({ type: 'done', transits, errors: [...errors] })
}
