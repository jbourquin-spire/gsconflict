/** Formats a Unix millisecond timestamp as `YYYY-MM-DD HH:mm:ss` in UTC. */
export function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/** Formats a duration in seconds as `Hh MMm SSs` / `Mm SSs`. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`
}

/** Formats an elapsed time in milliseconds, e.g. `850 ms`, `12.3 s`, `2m 22s`. */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  const totalSeconds = Math.round(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

/** Formats a Unix millisecond timestamp as `HH:mm:ss` in UTC. */
export function formatUtcTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19)
}
