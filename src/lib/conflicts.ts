import type { Transit } from './types'

/**
 * Two transits conflict when their time ranges intersect. Ranges that merely
 * touch (one stops exactly when the other starts) do not intersect.
 */
export function intersects(
  a: Pick<Transit, 'startMs' | 'stopMs'>,
  b: Pick<Transit, 'startMs' | 'stopMs'>,
): boolean {
  return a.startMs < b.stopMs && b.startMs < a.stopMs
}

/** Number of entries in the sorted array that are strictly less than `value`. */
function countLessThan(sorted: Float64Array, value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Number of entries in the sorted array that are less than or equal to `value`. */
function countAtMost(sorted: Float64Array, value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * For every transit, counts how many *other* transits in the list intersect it.
 * The list should contain the transits of a single ground station.
 *
 * Another transit does NOT intersect transit T exactly when it starts at/after
 * T stops, or stops at/before T starts (these two cases cannot both hold).
 * Every transit that stops at/before T starts also starts before T stops, so:
 *   intersecting = (#starts < T.stop) − (#stops ≤ T.start) − 1 (T itself)
 * which is computed in O(n log n) using two sorted arrays and binary search.
 */
export function countConflicts(transits: Transit[]): number[] {
  const starts = Float64Array.from(transits, (t) => t.startMs).sort()
  const stops = Float64Array.from(transits, (t) => t.stopMs).sort()

  return transits.map((t) => {
    const startingBeforeStop = countLessThan(starts, t.stopMs)
    const stoppedBeforeStart = countAtMost(stops, t.startMs)
    // Subtract 1 for the transit itself.
    return startingBeforeStop - stoppedBeforeStart - 1
  })
}

/** The other transits in `stationTransits` that intersect `transit`. */
export function findConflicts(
  transit: Transit,
  stationTransits: Transit[],
): Transit[] {
  return stationTransits
    .filter((other) => other.id !== transit.id && intersects(transit, other))
    .sort((a, b) => a.startMs - b.startMs)
}
