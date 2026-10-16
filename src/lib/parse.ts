import type { OrbitMeanElementsMessage } from '@nsat/jspredict'
import type { GroundStation, SatelliteInput } from './types'

/**
 * Ground station heights in the ground stations file are in meters, while
 * jspredict expects kilometers.
 */
const METERS_PER_KM = 1000

const TLE_LINE_1 = /^1 [\d ]{5}[A-Z ]/
const TLE_LINE_2 = /^2 [\d ]{5}/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses TLE text. Supports 2-line and 3-line sets, several per file. */
function parseTle(text: string, fileName: string): SatelliteInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  const satellites: SatelliteInput[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    if (!TLE_LINE_1.test(lines[i]) || !TLE_LINE_2.test(lines[i + 1])) continue

    const line1 = lines[i]
    const line2 = lines[i + 1]
    const previous = i > 0 ? lines[i - 1] : undefined
    const hasNameLine =
      previous !== undefined &&
      !TLE_LINE_1.test(previous) &&
      !TLE_LINE_2.test(previous)
    const noradId = line1.slice(2, 7).trim()
    const name = hasNameLine
      ? previous.replace(/^0 /, '').trim()
      : `NORAD ${noradId}`

    satellites.push({
      id: `${fileName}#${satellites.length}`,
      name,
      noradId,
      elements: `${name}\n${line1}\n${line2}`,
    })
    i++ // skip line 2
  }

  if (satellites.length === 0) {
    throw new Error('no valid TLE found')
  }
  return satellites
}

/** Parses OMM JSON (a single message or an array of messages). */
function parseOmm(json: unknown, fileName: string): SatelliteInput[] {
  const messages = Array.isArray(json) ? json : [json]
  const satellites = messages.map((message, index) => {
    if (
      !isRecord(message) ||
      message.MEAN_MOTION === undefined ||
      message.EPOCH === undefined
    ) {
      throw new Error(`entry ${index + 1} is not a valid OMM`)
    }
    const noradId =
      message.NORAD_CAT_ID !== undefined ? String(message.NORAD_CAT_ID) : ''
    const name =
      typeof message.OBJECT_NAME === 'string' && message.OBJECT_NAME !== ''
        ? message.OBJECT_NAME
        : `NORAD ${noradId || index + 1}`
    return {
      id: `${fileName}#${index}`,
      name,
      noradId,
      elements: message as unknown as OrbitMeanElementsMessage,
    }
  })

  if (satellites.length === 0) {
    throw new Error('no OMM entries found')
  }
  return satellites
}

/** Parses the contents of a TLE or OMM (JSON) file. */
export function parseElementFile(
  text: string,
  fileName: string,
): SatelliteInput[] {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown
    try {
      json = JSON.parse(trimmed)
    } catch {
      throw new Error('invalid JSON')
    }
    return parseOmm(json, fileName)
  }
  return parseTle(text, fileName)
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a number`)
  }
  return value
}

/**
 * Parses a ground stations file in the format:
 * [{ "name": "ACCGS", "location": { "latitude": 7.3, "longitude": -2.3, "height": 350 } }]
 */
export function parseGroundStations(text: string): GroundStation[] {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('invalid JSON')
  }
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error('expected a non-empty array of ground stations')
  }

  return json.map((entry, index) => {
    const path = `Ground station ${index + 1}`
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      throw new Error(`${path}: "name" must be a string`)
    }
    if (!isRecord(entry.location)) {
      throw new Error(`${path} (${entry.name}): "location" must be an object`)
    }
    const where = `${path} (${entry.name})`
    const latitude = requireNumber(entry.location.latitude, `${where}: latitude`)
    const longitude = requireNumber(
      entry.location.longitude,
      `${where}: longitude`,
    )
    const height = requireNumber(entry.location.height, `${where}: height`)
    if (latitude < -90 || latitude > 90) {
      throw new Error(`${where}: latitude must be between -90 and 90`)
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(`${where}: longitude must be between -180 and 180`)
    }
    return {
      name: entry.name,
      latitude,
      longitude,
      heightKm: height / METERS_PER_KM,
    }
  })
}
