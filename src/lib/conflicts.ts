import type { Transit } from './types'

/**
 * Two transits conflict when their AOS–LOS ranges intersect. Ranges that merely
 * touch (one LOS exactly when the other's AOS) do not intersect.
 */
export function intersects(
  a: Pick<Transit, 'aosMs' | 'losMs'>,
  b: Pick<Transit, 'aosMs' | 'losMs'>,
): boolean {
  return a.aosMs < b.losMs && b.aosMs < a.losMs
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
 * Another transit does NOT intersect transit T exactly when its AOS is at/after
 * T's LOS, or its LOS is at/before T's AOS (these two cases cannot both hold).
 * Every transit with LOS at/before T's AOS also has AOS before T's LOS, so:
 *   intersecting = (#AOS < T.LOS) − (#LOS ≤ T.AOS) − 1 (T itself)
 * which is computed in O(n log n) using two sorted arrays and binary search.
 */
export function countConflicts(transits: Transit[]): number[] {
  const aosTimes = Float64Array.from(transits, (t) => t.aosMs).sort()
  const losTimes = Float64Array.from(transits, (t) => t.losMs).sort()

  return transits.map((t) => {
    const aosBeforeLos = countLessThan(aosTimes, t.losMs)
    const losBeforeAos = countAtMost(losTimes, t.aosMs)
    // Subtract 1 for the transit itself.
    return aosBeforeLos - losBeforeAos - 1
  })
}

/** The other transits in `stationTransits` that intersect `transit`. */
export function findConflicts(
  transit: Transit,
  stationTransits: Transit[],
): Transit[] {
  return stationTransits
    .filter((other) => other.id !== transit.id && intersects(transit, other))
    .sort((a, b) => a.aosMs - b.aosMs)
}
