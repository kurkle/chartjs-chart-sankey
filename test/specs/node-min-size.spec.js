import { acquireChart } from '../utils'

// One huge node and several tiny ones in the same column, matching issue 87's
// shape (a report with flows of 0.37 and 85024 landing in the same column).
const data = [
  { flow: 85024, from: 'Huge', to: 'Sink' },
  { flow: 0.37, from: 'Tiny A', to: 'Sink' },
  { flow: 0.5, from: 'Tiny B', to: 'Sink' },
  { flow: 0.9, from: 'Tiny C', to: 'Sink' },
]

const NODE_WIDTH = 10

function buildSankeyWithMinSize(nodeMinSize) {
  return acquireChart(
    {
      data: {
        datasets: [{ data, nodeMinSize, nodeWidth: NODE_WIDTH }],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
      },
      type: 'sankey',
    },
    {
      canvas: { height: 400, width: 800 },
    }
  )
}

// Node bars are drawn as square-ish rects of width `nodeWidth`; flows are
// much wider/taller. Filtering by width isolates the fillRect calls that draw
// node bars.
function nodeBarRects(fillRect) {
  return fillRect.mock.calls
    .map(([x, y, width, height]) => ({ height, width, x, y }))
    .filter((rect) => rect.width === NODE_WIDTH)
}

function closestByCenter(rects, expectedCenter) {
  return rects.reduce((closest, rect) => {
    const center = rect.y + rect.height / 2
    const closestCenter = closest.y + closest.height / 2
    return Math.abs(center - expectedCenter) < Math.abs(closestCenter - expectedCenter)
      ? rect
      : closest
  })
}

describe('nodeMinSize', () => {
  it('calls a function-form nodeMinSize with a SankeyNode, not a Chart.js scriptable context', () => {
    const seenNodes = []

    buildSankeyWithMinSize((node) => {
      seenNodes.push(node)
      return 6
    })

    // The dataset-level `_scriptable: true` default would make Chart.js call
    // this itself with its own ScriptableContext (which has `chart` and
    // `dataIndex`) before the controller ever sees the raw option. The
    // sankey-specific `nodeMinSize` descriptor exception is what makes `node`
    // below a real SankeyNode (a plain `{ key, in, out, ... }`) instead.
    expect(seenNodes.length).toBeGreaterThan(0)
    seenNodes.forEach((node) => {
      expect(typeof node.key).toBe('string')
      expect(node.chart).toBeUndefined()
      expect(node.dataIndex).toBeUndefined()
    })
  })

  it('stretches a tiny node bar to at least nodeMinSize CSS pixels, centered on its natural position', () => {
    const minSize = 6

    // Baseline: without a minimum, Tiny A's bar is a fraction of a pixel
    // tall (flow 0.37 against ~85026 total flow over ~394 usable px).
    const chartWithoutMin = buildSankeyWithMinSize(0)
    const fillRectWithoutMin = vi.spyOn(chartWithoutMin.ctx, 'fillRect')
    chartWithoutMin.draw()
    const tinyAWithoutMin = chartWithoutMin.getDatasetMeta(0).controller._nodes.get('Tiny A')
    const yScaleWithoutMin = chartWithoutMin.scales.y
    const naturalCenter = yScaleWithoutMin.getPixelForValue(
      (tinyAWithoutMin.y ?? 0) + tinyAWithoutMin.size / 2
    )
    const naturalRect = closestByCenter(nodeBarRects(fillRectWithoutMin), naturalCenter)
    expect(naturalRect.height).toBeLessThan(1)

    // With the minimum, the same node's bar reaches at least minSize, and
    // stays centered on the same natural position (within the 1px tolerance
    // of comparing float pixel math against a fresh chart instance).
    const chart = buildSankeyWithMinSize(minSize)
    const fillRect = vi.spyOn(chart.ctx, 'fillRect')
    chart.draw()
    const tinyA = chart.getDatasetMeta(0).controller._nodes.get('Tiny A')
    const yScale = chart.scales.y
    const expectedCenter = yScale.getPixelForValue((tinyA.y ?? 0) + tinyA.size / 2)
    const stretchedRect = closestByCenter(nodeBarRects(fillRect), expectedCenter)

    expect(stretchedRect.height).toBeGreaterThanOrEqual(minSize - 1e-6)
    expect(stretchedRect.y + stretchedRect.height / 2).toBeCloseTo(expectedCenter, 1)
  })
})
