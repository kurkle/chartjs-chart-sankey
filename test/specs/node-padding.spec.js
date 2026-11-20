import { acquireChart } from 'chartjs-test-utils'

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
    // column 0, all flowing into the single sink Z.
    const columnData = [
      { flow: 10, from: 'A', to: 'Z' },
      { flow: 10, from: 'B', to: 'Z' },
      { flow: 10, from: 'C', to: 'Z' },
    ]

    function gaps(nodePadding) {
      const chart = acquireChart(
        {
          data: { datasets: [{ data: columnData, nodePadding }] },
          options: { animation: false },
          type: 'sankey',
        },
        { canvas: { height: 300, width: 300 } }
      )
      const rects = chart.getDatasetMeta(0).controller._geometry.nodes
      const a = rects.get('A')
      const b = rects.get('B')
      const c = rects.get('C')
      return { ab: b.y - (a.y + a.height), bc: c.y - (b.y + b.height) }
    }

    const base = gaps(10)
    const withGap = gaps({ B: { after: 40 } })

    expect(base.ab).toBeCloseTo(10, 6)
    expect(base.bc).toBeCloseTo(10, 6)
    // B's own gap to A is untouched -- only B's `after` changed.
    expect(withGap.ab).toBeCloseTo(10, 6)
    // The gap below B is the larger of B's `after` and C's `before`.
    expect(withGap.bc).toBeCloseTo(40, 6)
  })

  for (const orientation of ['horizontal', 'vertical']) {
    for (const nodePadding of [0, 4, 10, 25]) {
      it(`renders exactly ${nodePadding}px between nodes of the column that sets the scale (${orientation})`, () => {
        const chart = acquireChart(
          {
            data: { datasets: [{ data, nodePadding, orientation }] },
            options: { animation: false, maintainAspectRatio: false },
            type: 'sankey',
          },
          { canvas: { height: 400, width: 800 } }
        )
        const vertical = orientation === 'vertical'
        const rects = [...chart.getDatasetMeta(0).controller._geometry.nodes.values()]
        const start = (r) => (vertical ? r.x : r.y)
        const size = (r) => (vertical ? r.width : r.height)
        const column = (r) => (vertical ? r.y : r.x)
        const first = Math.min(...rects.map(column))
        const sources = rects.filter((r) => column(r) === first).sort((a, b) => start(a) - start(b))
        expect(sources.length).toBe(5)
        for (let i = 1; i < sources.length; i++) {
          expect(start(sources[i]) - (start(sources[i - 1]) + size(sources[i - 1]))).toBeCloseTo(
            nodePadding,
            6
          )
        }
        // Never closer than requested in any column, and the column fills the axis.
        const columns = new Map()
        for (const r of rects) columns.set(column(r), [...(columns.get(column(r)) ?? []), r])
        for (const list of columns.values()) {
          list.sort((a, b) => start(a) - start(b))
          for (let i = 1; i < list.length; i++) {
            expect(
              start(list[i]) - (start(list[i - 1]) + size(list[i - 1]))
            ).toBeGreaterThanOrEqual(nodePadding - 1e-6)
          }
        }
        const { chartArea } = chart
        const span = vertical ? chartArea.right - chartArea.left : chartArea.bottom - chartArea.top
        const last = sources[sources.length - 1]
        expect(start(last) + size(last) - start(sources[0])).toBeCloseTo(span, 6)
      })
    }
  }
})
