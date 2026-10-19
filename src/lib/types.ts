import type { OrbitMeanElementsMessage, TwoLineElement } from '@nsat/jspredict'

export interface SatelliteInput {
  /** Unique key for the satellite (source file + position in file). */
  id: string
  name: string
  noradId: string
  elements: TwoLineElement | OrbitMeanElementsMessage
}

export interface GroundStation {
  name: string
  /** Degrees */
  latitude: number
  /** Degrees */
  longitude: number
  /** Kilometers above the ellipsoid */
  heightKm: number
}

export interface Transit {
  id: string
  /** Acquisition of signal, Unix epoch milliseconds */
  aosMs: number
  /** Loss of signal, Unix epoch milliseconds */
  losMs: number
  /** AOS to LOS, in seconds */
  durationS: number
  /** Time of peak (maximum) elevation, Unix epoch milliseconds */
  peakMs: number
  /** Elevation at the peak, in degrees */
  peakElevationDeg: number
  /** Fraction of the Sun's disc obscured by the Earth at the peak (0 = fully lit, 1 = umbra) */
  peakEclipseFactor: number
  /** Time of closest approach, Unix epoch milliseconds */
  tcaMs: number
  groundStation: string
  satellite: string
  noradId: string
  /** Number of other transits at the same ground station whose AOS–LOS range intersects this one */
  conflicts: number
}

export interface TransitRequest {
  satellites: SatelliteInput[]
  groundStations: GroundStation[]
  /** Degrees */
  minElevation: number
  startMs: number
  stopMs: number
}

/** A unit of work for a worker: all satellites against one ground station. */
export interface WorkerJob {
  satellites: SatelliteInput[]
  groundStation: GroundStation
  /** Degrees */
  minElevation: number
  startMs: number
  stopMs: number
}

export type WorkerMessage =
  /** `done` is the number of satellites processed since the last message. */
  | { type: 'progress'; done: number }
  | { type: 'done'; transits: Transit[]; errors: string[] }

export interface TransitResult {
  transits: Transit[]
  errors: string[]
}
