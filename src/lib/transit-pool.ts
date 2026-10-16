import type {
  Transit,
  TransitRequest,
  TransitResult,
  WorkerJob,
  WorkerMessage,
} from './types'

/** Selectable numbers of parallel workers. */
export const WORKER_COUNT_OPTIONS = [1, 2, 4, 6, 8]
export const DEFAULT_WORKER_COUNT = 4

export interface TransitCalculation {
  promise: Promise<TransitResult>
  /** Terminates all workers. The promise never settles after cancelling. */
  cancel: () => void
}

/**
 * Calculates transits using a pool of `workerCount` web workers (never more
 * than the number of ground stations). Each job is a single ground
 * station against all satellites; idle workers pick up the next station until
 * every station has been processed.
 */
export function calculateTransits(
  request: TransitRequest,
  workerCount: number,
  onProgress: (done: number, total: number) => void,
): TransitCalculation {
  const { satellites, groundStations, minElevation, startMs, stopMs } = request
  const total = satellites.length * groundStations.length
  const queue = [...groundStations]
  const workers: Worker[] = []
  const results: Transit[][] = []
  const errors = new Set<string>()
  let completedJobs = 0
  let doneCount = 0

  const cancel = () => {
    for (const worker of workers) worker.terminate()
    workers.length = 0
  }

  const promise = new Promise<TransitResult>((resolve, reject) => {
    const finish = () => {
      cancel()
      const transits = results.flat()
      transits.sort((a, b) => a.startMs - b.startMs)
      resolve({ transits, errors: [...errors] })
    }

    if (groundStations.length === 0) {
      finish()
      return
    }

    const startNextJob = (worker: Worker) => {
      const groundStation = queue.shift()
      if (!groundStation) return
      const job: WorkerJob = {
        satellites,
        groundStation,
        minElevation,
        startMs,
        stopMs,
      }
      worker.postMessage(job)
    }

    const poolSize = Math.min(workerCount, groundStations.length)
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(
        new URL('../workers/transits.worker.ts', import.meta.url),
        { type: 'module' },
      )
      workers.push(worker)

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === 'progress') {
          doneCount += message.done
          onProgress(doneCount, total)
          return
        }
        results.push(message.transits)
        for (const error of message.errors) errors.add(error)
        completedJobs++
        if (completedJobs === groundStations.length) {
          finish()
        } else {
          startNextJob(worker)
        }
      }
      worker.onerror = (event) => {
        cancel()
        reject(new Error(event.message || 'Calculation failed'))
      }

      startNextJob(worker)
    }
  })

  return { promise, cancel }
}
