import { describe, expect, it } from 'vitest'
import { countConflicts, findConflicts } from '../conflicts'
import type { Transit } from '../types'

function transit(id: string, aosMs: number, losMs: number): Transit {
  return {
    id,
    aosMs,
    losMs,
    durationS: (losMs - aosMs) / 1000,
    peakMs: aosMs,
    peakElevationDeg: 45,
    peakEclipseFactor: 0,
    tcaMs: aosMs,
    groundStation: 'GS',
    satellite: id,
    noradId: id,
    conflicts: 0,
  }
}

describe('conflicts', () => {
  const a = transit('a', 0, 10)
  const b = transit('b', 5, 15) // overlaps a and c
  const c = transit('c', 12, 20) // overlaps b only
  const d = transit('d', 20, 30) // touches c: no conflict
  const e = transit('e', 2, 4) // inside a and... a only
  const all = [a, b, c, d, e]

  it('counts intersecting transits', () => {
    expect(countConflicts(all)).toEqual([2, 2, 1, 0, 1])
  })

  it('agrees with the brute-force finder', () => {
    expect(countConflicts(all)).toEqual(
      all.map((t) => findConflicts(t, all).length),
    )
  })

  it('lists the conflicting transits sorted by AOS time', () => {
    expect(findConflicts(a, all).map((t) => t.id)).toEqual(['e', 'b'])
  })

  it('does not count transits that only touch', () => {
    expect(findConflicts(d, all)).toEqual([])
  })

  it('handles an empty list', () => {
    expect(countConflicts([])).toEqual([])
  })

  it('matches the brute-force finder on random data', () => {
    let seed = 42
    const random = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
    const many = Array.from({ length: 500 }, (_, i) => {
      const start = Math.floor(random() * 1000)
      return transit(`t${i}`, start, start + 1 + Math.floor(random() * 40))
    })
    expect(countConflicts(many)).toEqual(
      many.map((t) => findConflicts(t, many).length),
    )
  })
})
