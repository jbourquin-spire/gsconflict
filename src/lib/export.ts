import { intersects } from './conflicts'
import type { Transit } from './types'

const HEADER = [
  'satellite',
  'norad_id',
  'aos_utc',
  'los_utc',
  'duration_s',
  'peak_elevation_utc',
  'peak_elevation_deg',
  'tca_utc',
  'ground_station',
  'conflicts',
  'conflicting_satellites',
]

/** Quotes a CSV field when it contains a delimiter, quote or line break. */
function escapeField(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * For every transit, the names of the satellites of the other transits at the
 * same ground station that intersect it. `transits` should be the complete
 * (unfiltered) result so that conflicts are not hidden by display filters.
 * Runs a sweep over each station's transits sorted by AOS, so the work is
 * proportional to the number of conflicting pairs.
 */
export function conflictingSatellites(
  transits: Transit[],
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const byStation = new Map<string, Transit[]>()
  for (const t of transits) {
    result.set(t.id, [])
    const list = byStation.get(t.groundStation)
    if (list) list.push(t)
    else byStation.set(t.groundStation, [t])
  }

  for (const list of byStation.values()) {
    const sorted = [...list].sort((a, b) => a.aosMs - b.aosMs)
    let active: Transit[] = []
    for (const t of sorted) {
      // Anything that has ended by this AOS cannot conflict with it or later transits.
      active = active.filter((other) => other.losMs > t.aosMs)
      for (const other of active) {
        if (!intersects(t, other)) continue
        result.get(t.id)!.push(other.satellite)
        result.get(other.id)!.push(t.satellite)
      }
      active.push(t)
    }
  }
  return result
}

/**
 * Builds a CSV of the given transits. The conflict columns are the number of
 * conflicts and a JSON array of the satellites in conflict. `allTransits` is
 * used to find those satellites (defaults to `transits`).
 */
export function transitsToCsv(
  transits: Transit[],
  allTransits: Transit[] = transits,
): string {
  const satellitesById = conflictingSatellites(allTransits)
  const rows = transits.map((t) => {
    const satellites = (satellitesById.get(t.id) ?? []).sort()
    return [
      t.satellite,
      t.noradId,
      new Date(t.aosMs).toISOString(),
      new Date(t.losMs).toISOString(),
      t.durationS.toFixed(1),
      new Date(t.peakMs).toISOString(),
      t.peakElevationDeg.toFixed(2),
      new Date(t.tcaMs).toISOString(),
      t.groundStation,
      t.conflicts,
      JSON.stringify(satellites),
    ]
      .map(escapeField)
      .join(',')
  })
  return [HEADER.join(','), ...rows].join('\r\n') + '\r\n'
}

/** Triggers a browser download of `content` as a file. */
export function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
