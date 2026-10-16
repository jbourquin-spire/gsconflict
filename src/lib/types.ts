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
  /** Unix epoch milliseconds */
  startMs: number
  /** Unix epoch milliseconds */
  stopMs: number
  /** Seconds */
  durationS: number
  groundStation: string
  satellite: string
  noradId: string
  /** Number of other transits at the same ground station that intersect this one */
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
