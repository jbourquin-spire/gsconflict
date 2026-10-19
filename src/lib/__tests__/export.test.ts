import { describe, expect, it } from 'vitest'
import { countConflicts } from '../conflicts'
import { conflictingSatellites, transitsToCsv } from '../export'
import type { Transit } from '../types'

function transit(id: string, aosMs: number, losMs: number, station = 'GS'): Transit {
  return {
    id,
    aosMs,
    losMs,
    durationS: (losMs - aosMs) / 1000,
    peakMs: aosMs,
    peakElevationDeg: 45,
    peakEclipseFactor: 0,
    tcaMs: aosMs,
    groundStation: station,
    satellite: `SAT ${id}`,
    noradId: id,
    conflicts: 0,
  }
}

const all = [
  transit('a', 0, 10),
  transit('b', 5, 15),
  transit('c', 12, 20),
  transit('d', 20, 30),
  transit('e', 2, 4),
  transit('f', 5, 15, 'OTHER'),
]
const counts = countConflicts(all.filter((t) => t.groundStation === 'GS'))

describe('export', () => {
  it('finds conflicting satellites per station', () => {
    const result = conflictingSatellites(all)
    expect(result.get('a')!.sort()).toEqual(['SAT b', 'SAT e'])
    expect(result.get('b')!.sort()).toEqual(['SAT a', 'SAT c'])
    expect(result.get('d')).toEqual([])
    expect(result.get('f')).toEqual([])
    expect(result.get('a')!.length).toBe(counts[0])
  })

  it('writes a CSV with a conflict count and satellite array', () => {
    const t = { ...all[0], conflicts: 2 }
    const [header, row] = transitsToCsv([t], all).split('\r\n')
    expect(header.endsWith('conflicts,conflicting_satellites')).toBe(true)
    expect(row).toBe(
      'SAT a,a,1970-01-01T00:00:00.000Z,1970-01-01T00:00:00.010Z,0.0,1970-01-01T00:00:00.000Z,45.00,0.0000,1970-01-01T00:00:00.000Z,GS,2,"[""SAT b"",""SAT e""]"',
    )
  })
})
