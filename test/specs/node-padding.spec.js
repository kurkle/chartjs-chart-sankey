import { acquireChart } from '../utils'

// Same energy data as resize.spec.js: column 0 has five nodes (Oil, Natural
// gas, Coal, Nuclear, Renewables), so nodePadding gaps actually show up.
const data = [
  { flow: 15, from: 'Oil', to: 'Fossil fuels' },
  { flow: 20, from: 'Natural gas', to: 'Fossil fuels' },
  { flow: 25, from: 'Coal', to: 'Fossil fuels' },
  { flow: 60, from: 'Fossil fuels', to: 'Energy' },
  { flow: 10, from: 'Nuclear', to: 'Energy' },
  { flow: 30, from: 'Renewables', to: 'Energy' },
  { flow: 40, from: 'Energy', to: 'Electricity' },
  { flow: 35, from: 'Energy', to: 'Heat' },
  { flow: 25, from: 'Energy', to: 'Lost' },
]

function buildSankey(devicePixelRatio) {
  return acquireChart(
    {
      data: {
        datasets: [{ data, nodePadding: 10 }],
      },
      options: {
        animation: false,
        devicePixelRatio,
        maintainAspectRatio: false,
      },
      type: 'sankey',
    },
    {
      canvas: { height: 400, width: 800 },
    }
  )
}

function buildSankeyWithPadding(nodePadding) {
  return acquireChart(
    {
      data: {
        datasets: [{ data, nodePadding }],
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

describe('nodePadding', () => {
  it('lays out flows identically regardless of devicePixelRatio (#CSS-pixels)', () => {
    const chart1x = buildSankey(1)
    const chart2x = buildSankey(2)

    const flows1x = chart1x.getDatasetMeta(0).data
    const flows2x = chart2x.getDatasetMeta(0).data

    expect(flows1x.length).toBeGreaterThan(0)
    expect(flows1x.length).toBe(flows2x.length)

    flows1x.forEach((flow1x, i) => {
      const flow2x = flows2x[i]
      expect(flow2x.x, `flow ${i} x`).toBeCloseTo(flow1x.x, 2)
      expect(flow2x.y, `flow ${i} y`).toBeCloseTo(flow1x.y, 2)
      expect(flow2x.x2, `flow ${i} x2`).toBeCloseTo(flow1x.x2, 2)
      expect(flow2x.y2, `flow ${i} y2`).toBeCloseTo(flow1x.y2, 2)
      expect(flow2x.height, `flow ${i} height`).toBeCloseTo(flow1x.height, 2)
    })
  })

  it('calls a function-form nodePadding with a SankeyNode, not a Chart.js scriptable context (#265)', () => {
    const seenNodes = []

    buildSankeyWithPadding((node) => {
      seenNodes.push(node)
      return 10
    })

    // The dataset-level `_scriptable: true` default would make Chart.js call
    // this itself with its own ScriptableContext (which has `chart` and
    // `dataIndex`) before the controller ever sees the raw option. The
    // sankey-specific `nodePadding` descriptor exception is what makes `node`
    // below a real SankeyNode (a plain `{ key, in, out, ... }`) instead.
    expect(seenNodes.length).toBeGreaterThan(0)
    seenNodes.forEach((node) => {
      expect(typeof node.key).toBe('string')
      expect(node.chart).toBeUndefined()
      expect(node.dataIndex).toBeUndefined()
    })
  })

  it('shifts only the node below the keyed one when using a Record of per-node gaps', () => {
    // A, B, C are three unconnected sources stacked (in that order) in
    // column 0, all flowing into the single sink Z. Comparing the parsed
    // (pre-pixel, pre-axis-rescale) `y` of each source's flow isolates the
    // padding math from the y-axis's max (which shifts between the two
    // charts below, so pixel positions alone would not be comparable).
    const columnData = [
      { flow: 10, from: 'A', to: 'Z' },
      { flow: 10, from: 'B', to: 'Z' },
      { flow: 10, from: 'C', to: 'Z' },
    ]

    // A fixed CSS canvas height, matched by both charts below, makes the
    // nodePadding-in-CSS-pixels -> flow-units scale factor identical and
    // known: scale = maxY-before-padding / chart.height = 30 / 300 = 0.1, so
    // a 30 CSS pixel increase in the B -> C gap is exactly a 3 flow-unit
    // increase in C's parsed y.
    function fromYs(nodePadding) {
      const chart = acquireChart(
        {
          data: { datasets: [{ data: columnData, nodePadding }] },
          options: { animation: false },
          type: 'sankey',
        },
        { canvas: { height: 300, width: 300 } }
      )
      const controller = chart.getDatasetMeta(0).controller
      return columnData.map((_, i) => controller.getParsed(i).y)
    }

    const base = fromYs(10)
    const withGap = fromYs({ B: { after: 40 } })

    // A is the topmost node in the column and never receives an offset.
    expect(base[0]).toBeCloseTo(0, 6)
    expect(withGap[0]).toBeCloseTo(0, 6)

    // B's own gap to A is untouched -- only B's `after` (the gap below B)
    // changed, which does not affect the gap above it.
    expect(withGap[1]).toBeCloseTo(base[1], 6)

    // C sits below B, so raising B's `after` from the default 10 to 40 CSS
    // pixels must push C down by exactly that 30 CSS pixel difference,
    // scaled to flow units.
    expect(withGap[2] - base[2]).toBeCloseTo(3, 6)
  })
})
