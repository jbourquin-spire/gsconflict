/**
 * Colors cycled through for the rows of the conflict Gantt chart. They are
 * chosen to stay distinct from one another and legible on the dark background.
 */
export const GANTT_COLORS = [
  '#38bdf8', // sky
  '#f472b6', // pink
  '#a3e635', // lime
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#2dd4bf', // teal
  '#fb923c', // orange
  '#60a5fa', // blue
  '#e879f9', // fuchsia
  '#4ade80', // green
] as const

/** The color for the given row; wraps around once the palette is exhausted. */
export function ganttColor(index: number): string {
  return GANTT_COLORS[index % GANTT_COLORS.length]
}
