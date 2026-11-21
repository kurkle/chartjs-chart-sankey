import type { Chart, ChartEvent, InteractionItem, InteractionModeFunction } from 'chart.js'
import type Flow from './flow.js'

import { Interaction } from 'chart.js'
import { getRelativePosition } from 'chart.js/helpers'

/**
 * The interaction mode of a sankey chart, `'sankey'`: of the flows that are hit at the
 * mouse, the one whose band is nearest to it. A thin flow is hit within a pixel and a
 * half of its center line, so the areas of two flows can overlap; `nearest` would compare
 * the centers of the flows, and could give a point on a thick flow to a thin one beside it.
 * Without `intersect`, or with other charts mixed in, it is Chart.js's `nearest`.
 */
export const sankeyMode: InteractionModeFunction = (
  chart: Chart,
  e: ChartEvent,
  options,
  useFinalPosition
): InteractionItem[] => {
  const metas = chart.getSortedVisibleDatasetMetas()
  if (!options.intersect || metas.some((meta) => meta.type !== 'sankey')) {
    return Interaction.modes.nearest(chart, e, options, useFinalPosition)
  }
  const { x, y } = getRelativePosition(e, chart)
  let best: InteractionItem | undefined
  let [bestBand, bestCenter] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  for (const meta of metas) {
    meta.data.forEach((element, index) => {
      const flow = element as unknown as Flow & { skip?: boolean }
      if (flow.skip || !flow.inRange(x, y, !!useFinalPosition)) return
      const band = flow.distance(x, y, !!useFinalPosition)
      // flows that are painted at the point tie at 0: the nearer center decides
      const center = flow.getCenterPoint(!!useFinalPosition)
      const middle = Math.hypot(x - center.x, y - center.y)
      if (band < bestBand || (band === bestBand && middle < bestCenter)) {
        ;[bestBand, bestCenter] = [band, middle]
        best = { datasetIndex: meta.index, element, index }
      }
    })
  }
  return best ? [best] : []
}

/** Makes `'sankey'` a mode Chart.js knows. */
export function registerSankeyMode() {
  ;(Interaction.modes as unknown as Record<string, InteractionModeFunction>).sankey = sankeyMode
}
