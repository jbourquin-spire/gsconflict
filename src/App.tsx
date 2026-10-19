import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { MultiSelectFilter } from '@/components/multi-select-filter'
import { TRANSIT_COLUMN_COUNT, TransitRow } from '@/components/transit-row'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadCsv, transitsToCsv } from '@/lib/export'
import { formatElapsed, formatUtc } from '@/lib/format'
import { parseElementFile, parseGroundStations } from '@/lib/parse'
import {
  calculateTransits,
  DEFAULT_WORKER_COUNT,
  WORKER_COUNT_OPTIONS,
} from '@/lib/transit-pool'
import type { GroundStation, SatelliteInput, Transit } from '@/lib/types'

const DEFAULT_MIN_ELEVATION = '5'
/** Look-ahead durations; `hours` is the value used in the calculation. */
const LOOKAHEAD_OPTIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
  { hours: 7 * 24, label: '7 days' },
  { hours: 30 * 24, label: '30 days' },
]
const DEFAULT_LOOKAHEAD_HOURS = '24'
const MS_PER_HOUR = 3_600_000
const PAGE_SIZE = 100

/** Current UTC time formatted for a datetime-local input (minute precision). */
function nowForInput(): string {
  return new Date().toISOString().slice(0, 16)
}

/** Interprets a datetime-local value as UTC. Returns NaN if it is empty/invalid. */
function parseInputUtc(value: string): number {
  return value ? Date.parse(`${value}:00Z`) : Number.NaN
}

interface Metrics {
  /** Wall-clock calculation time in milliseconds */
  elapsedMs: number
  /** Number of satellite / ground station combinations evaluated */
  pairs: number
  /** Number of workers that were used */
  workers: number
}

interface Progress {
  done: number
  total: number
}

export default function App() {
  const [satellites, setSatellites] = useState<SatelliteInput[]>([])
  const [groundStations, setGroundStations] = useState<GroundStation[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [groundStationError, setGroundStationError] = useState<string | null>(
    null,
  )
  const [minElevation, setMinElevation] = useState(DEFAULT_MIN_ELEVATION)
  const [workerCount, setWorkerCount] = useState(String(DEFAULT_WORKER_COUNT))
  const [startTime, setStartTime] = useState(nowForInput)
  const [lookaheadHours, setLookaheadHours] = useState(
    DEFAULT_LOOKAHEAD_HOURS,
  )

  const [progress, setProgress] = useState<Progress | null>(null)
  const [transits, setTransits] = useState<Transit[] | null>(null)
  const [calcErrors, setCalcErrors] = useState<string[]>([])
  const [analysisWindow, setAnalysisWindow] = useState<{ start: number; stop: number } | null>(
    null,
  )
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // `null` means "All" (no filtering)
  const [stationFilter, setStationFilter] = useState<Set<string> | null>(null)
  const [satelliteFilter, setSatelliteFilter] = useState<Set<string> | null>(
    null,
  )
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [liveElapsedMs, setLiveElapsedMs] = useState(0)

  const cancelRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelRef.current?.(), [])

  const minElevationValue = Number(minElevation)
  const startMsValue = parseInputUtc(startTime)
  const startTimeValid = Number.isFinite(startMsValue)
  const minElevationValid =
    minElevation.trim() !== '' &&
    Number.isFinite(minElevationValue) &&
    minElevationValue >= 0 &&
    minElevationValue < 90
  const calculating = progress !== null
  const percentComplete =
    progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0

  // Tick a live elapsed-time counter while a calculation is running.
  useEffect(() => {
    if (!calculating) return
    const started = performance.now()
    setLiveElapsedMs(0)
    const interval = setInterval(
      () => setLiveElapsedMs(performance.now() - started),
      250,
    )
    return () => clearInterval(interval)
  }, [calculating])
  const canCalculate =
    satellites.length > 0 &&
    groundStations.length > 0 &&
    minElevationValid &&
    startTimeValid &&
    !calculating

  async function handleSatelliteFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const loaded: SatelliteInput[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      try {
        loaded.push(...parseElementFile(await file.text(), file.name))
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : error}`,
        )
      }
    }
    setSatellites(loaded)
    setFileErrors(errors)
  }

  async function handleGroundStationFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    try {
      setGroundStations(parseGroundStations(await file.text()))
      setGroundStationError(null)
    } catch (error) {
      setGroundStations([])
      setGroundStationError(
        `${file.name}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function calculate() {
    cancelRef.current?.()
    const startMs = startMsValue
    const calcStarted = performance.now()
    const pairs = satellites.length * groundStations.length
    const stopMs = startMs + Number(lookaheadHours) * MS_PER_HOUR
    const workers = Math.min(Number(workerCount), groundStations.length)

    setProgress({ done: 0, total: pairs })
    setTransits(null)
    setMetrics(null)
    setCalcErrors([])
    setPage(0)
    setExpanded(new Set())
    setStationFilter(null)
    setSatelliteFilter(null)

    const calculation = calculateTransits(
      {
        satellites,
        groundStations,
        minElevation: minElevationValue,
        startMs,
        stopMs,
      },
      workers,
      (done, total) => setProgress({ done, total }),
    )
    cancelRef.current = calculation.cancel

    calculation.promise
      .then((result) => {
        setMetrics({
          elapsedMs: performance.now() - calcStarted,
          pairs,
          workers,
        })
        setTransits(result.transits)
        setCalcErrors(result.errors)
        setAnalysisWindow({ start: startMs, stop: stopMs })
        setProgress(null)
      })
      .catch((error) => {
        setCalcErrors([
          error instanceof Error ? error.message : 'Calculation failed',
        ])
        setProgress(null)
      })
  }

  const transitsByStation = useMemo(() => {
    const byStation = new Map<string, Transit[]>()
    for (const transit of transits ?? []) {
      const list = byStation.get(transit.groundStation)
      if (list) list.push(transit)
      else byStation.set(transit.groundStation, [transit])
    }
    return byStation
  }, [transits])
  const stationOptions = useMemo(
    () => [...transitsByStation.keys()].sort(),
    [transitsByStation],
  )
  const satelliteOptions = useMemo(
    () => [...new Set((transits ?? []).map((t) => t.satellite))].sort(),
    [transits],
  )
  // Conflict counts and the Gantt charts always use the unfiltered results.
  const filteredTransits = useMemo(() => {
    if (!transits || (!stationFilter && !satelliteFilter)) return transits
    return transits.filter(
      (t) =>
        (!stationFilter || stationFilter.has(t.groundStation)) &&
        (!satelliteFilter || satelliteFilter.has(t.satellite)),
    )
  }, [transits, stationFilter, satelliteFilter])
  const isFiltered = stationFilter !== null || satelliteFilter !== null
  const pageCount = filteredTransits
    ? Math.max(1, Math.ceil(filteredTransits.length / PAGE_SIZE))
    : 1
  const visible = useMemo(
    () =>
      filteredTransits?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [],
    [filteredTransits, page],
  )

  function changeStationFilter(next: Set<string> | null) {
    setStationFilter(next)
    setPage(0)
  }

  function changeSatelliteFilter(next: Set<string> | null) {
    setSatelliteFilter(next)
    setPage(0)
  }

  function exportCsv() {
    if (!transits || !filteredTransits) return
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
    downloadCsv(
      transitsToCsv(filteredTransits, transits),
      `transits-${stamp}.csv`,
    )
  }

  return (
    <main className="flex w-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Ground Station Conflicts</h1>
        <p className="text-sm text-muted-foreground">
          Calculate satellite transits over a set of ground stations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            Select the satellites and ground stations to analyze.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="satellites">TLE / OMM Files</Label>
              <Input
                id="satellites"
                type="file"
                multiple
                accept=".tle,.txt,.3le,.json,.omm"
                onChange={(e) => handleSatelliteFiles(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                TLE (2- or 3-line) or OMM JSON. A file may hold several satellites.
              </p>
              {satellites.length > 0 && (
                <Badge variant="secondary">
                  {satellites.length} satellite{satellites.length === 1 ? '' : 's'}{' '}
                  loaded
                </Badge>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ground-stations">Ground Stations</Label>
              <Input
                id="ground-stations"
                type="file"
                accept=".json"
                onChange={(e) => handleGroundStationFile(e.target.files)}
              />
              <p className="text-xs text-muted-foreground">
                JSON array of {'{ name, location: { latitude, longitude, height } }'}
                ; height in meters.
              </p>
              {groundStations.length > 0 && (
                <Badge variant="secondary">
                  {groundStations.length} ground station
                  {groundStations.length === 1 ? '' : 's'} loaded
                </Badge>
              )}
            </div>
          </div>

          {(fileErrors.length > 0 || groundStationError) && (
            <Alert variant="destructive">
              <AlertTitle>Could not read some files</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {groundStationError && <li>{groundStationError}</li>}
                  {fileErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis settings</CardTitle>
          <CardDescription>
            Choose the time range and visibility threshold for transits.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="start-time">Look-ahead start time (UTC)</Label>
              <div className="flex gap-2">
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={startTime}
                  aria-invalid={!startTimeValid}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStartTime(nowForInput())}
                >
                  Now
                </Button>
              </div>
              {!startTimeValid && (
                <p className="text-xs text-destructive">
                  Enter a valid start date and time.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lookahead">Look-ahead duration</Label>
              <Select value={lookaheadHours} onValueChange={setLookaheadHours}>
                <SelectTrigger id="lookahead" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOOKAHEAD_OPTIONS.map(({ hours, label }) => (
                    <SelectItem key={hours} value={String(hours)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="min-elevation">Minimum elevation (degrees)</Label>
              <Input
                id="min-elevation"
                type="number"
                min={0}
                max={89.9}
                step="any"
                value={minElevation}
                aria-invalid={!minElevationValid}
                onChange={(e) => setMinElevation(e.target.value)}
              />
              {!minElevationValid && (
                <p className="text-xs text-destructive">
                  Enter a value from 0 up to (but not including) 90.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workers">Concurrency</Label>
              <Select value={workerCount} onValueChange={setWorkerCount}>
                <SelectTrigger id="workers" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_COUNT_OPTIONS.map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={calculate} disabled={!canCalculate}>
              {calculating && <Loader2 className="animate-spin" />}
              {calculating ? 'Calculating…' : 'Calculate transits'}
            </Button>
            {progress && (
              <div className="flex max-w-md flex-1 items-center gap-3">
                <Progress
                  value={percentComplete}
                  aria-label="Calculation progress"
                />
                <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {Math.floor(percentComplete)}% ·{' '}
                  {formatElapsed(liveElapsedMs)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {calcErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Some satellites could not be propagated</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {calcErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {transits && analysisWindow && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle>Transits</CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={!filteredTransits || filteredTransits.length === 0}
                onClick={exportCsv}
              >
                <Download />
                Export CSV
              </Button>
            </div>
            <CardDescription>
              {isFiltered && filteredTransits
                ? `${filteredTransits.length.toLocaleString()} of ${transits.length.toLocaleString()}`
                : transits.length.toLocaleString()}{' '}
              transit{transits.length === 1 ? '' : 's'} between{' '}
              {formatUtc(analysisWindow.start)} and {formatUtc(analysisWindow.stop)} UTC at{' '}
              {minElevationValue}° minimum elevation. All times are UTC.
            </CardDescription>
            {metrics && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">
                  Calculated in {formatElapsed(metrics.elapsedMs)}
                </Badge>
                <Badge variant="secondary">
                  {metrics.pairs.toLocaleString()} satellite/station pairs
                </Badge>
                <Badge variant="secondary">
                  {metrics.workers} {metrics.workers === 1 ? 'worker' : 'workers'}
                </Badge>
                <Badge variant="secondary">
                  {(metrics.elapsedMs / metrics.pairs).toFixed(1)} ms per pair
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <MultiSelectFilter
                      label="Satellite"
                      options={satelliteOptions}
                      selected={satelliteFilter}
                      onChange={changeSatelliteFilter}
                    />
                  </TableHead>
                  <TableHead>NORAD ID</TableHead>
                  <TableHead>AOS time (UTC)</TableHead>
                  <TableHead>LOS time (UTC)</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Peak elevation</TableHead>
                  <TableHead>Peak eclipse factor</TableHead>
                  <TableHead>
                    <MultiSelectFilter
                      label="Ground station"
                      options={stationOptions}
                      selected={stationFilter}
                      onChange={changeStationFilter}
                    />
                  </TableHead>
                  <TableHead className="text-center">Conflicts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={TRANSIT_COLUMN_COUNT}
                      className="text-center text-muted-foreground"
                    >
                      {isFiltered ? 'No transits match the filters.' : 'No transits found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((transit, index) => (
                    <TransitRow
                      key={transit.id}
                      transit={transit}
                      striped={index % 2 === 1}
                      stationTransits={
                        transitsByStation.get(transit.groundStation) ?? []
                      }
                      expanded={expanded.has(transit.id)}
                      onToggle={() => toggleExpanded(transit.id)}
                    />
                  ))
                )}
              </TableBody>
            </Table>

            {pageCount > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
