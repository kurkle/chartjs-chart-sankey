import { acquireChart } from 'chartjs-test-utils'

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

    // The flow leaving Tiny A keeps its natural position, so the middle of its
    // start is where the bar has to stay centered.
    function tinyA(chart) {
      const meta = chart.getDatasetMeta(0)
      const rect = meta.controller._geometry.nodes.get('Tiny A')
      const flow = meta.data.find((f) => f.from.key === 'Tiny A')
      return { center: flow.y + flow.height / 2, rect }
    }

    // Baseline: without a minimum, Tiny A's bar is a fraction of a pixel
    // tall (flow 0.37 against ~85026 total flow over ~394 usable px).
    const without = tinyA(buildSankeyWithMinSize(0))
    expect(without.rect.height).toBeLessThan(1)

    const withMin = tinyA(buildSankeyWithMinSize(minSize))
    expect(withMin.rect.height).toBeGreaterThanOrEqual(minSize - 1e-6)
    expect(withMin.rect.y + withMin.rect.height / 2).toBeCloseTo(withMin.center, 6)
  })

  it('keeps the requested gap between stretched bars', () => {
    const chart = buildSankeyWithMinSize(6)
    const rects = [...chart.getDatasetMeta(0).controller._geometry.nodes.values()]
      .filter((rect) => rect.x === rects0X(chart))
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i].y - (rects[i - 1].y + rects[i - 1].height)).toBeCloseTo(10, 6)
    }
    for (const rect of rects) expect(rect.height).toBeGreaterThanOrEqual(6 - 1e-6)
  })
})

function rects0X(chart) {
  return chart.getDatasetMeta(0).controller._geometry.nodes.get('Huge').x
}
