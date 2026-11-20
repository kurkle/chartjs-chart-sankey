import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'C' },
  { flow: 4, from: 'B', to: 'D' },
  { flow: 8, from: 'C', to: 'E' },
  { flow: 8, from: 'C', to: 'F' },
  { flow: 4, from: 'D', to: 'F' },
]

function build(dataset = {}, options = {}, canvas = { height: 300, width: 500 }) {
  return acquireChart(
    {
      data: { datasets: [{ data, label: 'Flows', ...dataset }] },
      options: { animation: false, maintainAspectRatio: false, ...options },
      type: 'sankey',
    },
    { canvas }
  )
}

function boxes(chart) {
  const meta = chart.getDatasetMeta(0)
  const nodes = [...meta.controller._geometry.nodes.values()].map((r) => ({
    bottom: r.y + r.height,
    left: r.x,
    right: r.x + r.width,
    top: r.y,
  }))
  const flows = meta.data.map((f) => ({
    bottom: Math.max(f.y, f.y2) + Math.max(f.height, 0),
    left: Math.min(f.x, f.x2),
    right: Math.max(f.x, f.x2) + f.width,
    top: Math.min(f.y, f.y2),
  }))
  return { flows, nodes }
}

function union(list) {
  return {
    bottom: Math.max(...list.map((b) => b.bottom)),
    left: Math.min(...list.map((b) => b.left)),
    right: Math.max(...list.map((b) => b.right)),
    top: Math.min(...list.map((b) => b.top)),
  }
}

describe('geometry in update', () => {
  const layouts = [
    ['title top, legend top', {}, {}],
    [
      'title bottom, legend right',
      {},
      { plugins: { legend: { position: 'right' }, title: { position: 'bottom' } } },
    ],
  ]
  for (const orientation of ['horizontal', 'vertical']) {
    for (const [name, , extra] of layouts) {
      it(`keeps everything inside the chart area and fills it (${orientation}, ${name})`, () => {
        const chart = build(
          { orientation },
          {
            ...extra,
            plugins: {
              legend: { display: true, ...extra.plugins?.legend },
              title: { display: true, text: 'Title', ...extra.plugins?.title },
            },
          }
        )
        const { chartArea } = chart
        const reserved =
          chartArea.top -
          3 +
          (chart.height - 3 - chartArea.bottom) +
          (chart.width - 3 - chartArea.right)
        expect(reserved).toBeGreaterThan(20)
        const { flows, nodes } = boxes(chart)
        const all = union([...nodes, ...flows])
        // the outline of the node bars stays inside too
        const eps = 1e-6
        expect(all.left).toBeGreaterThanOrEqual(chartArea.left - eps)
        expect(all.right).toBeLessThanOrEqual(chartArea.right + eps)
        expect(all.top).toBeGreaterThanOrEqual(chartArea.top - eps)
        expect(all.bottom).toBeLessThanOrEqual(chartArea.bottom + eps)
        // fills the area along both axes
        const n = union(nodes)
        expect(n.right - n.left).toBeGreaterThanOrEqual(chartArea.right - chartArea.left - 2 - 1e-6)
        expect(n.bottom - n.top).toBeGreaterThanOrEqual(chartArea.bottom - chartArea.top - 2 - 1e-6)
      })
    }
  }

  it('recomputes the geometry on resize', () => {
    const chart = build()
    const before = chart.getDatasetMeta(0).data.map((f) => [f.x, f.x2, f.y, f.height])
    const plan = chart.getDatasetMeta(0).controller._plan
    chart.resize(300, 500)
    // Same topology, new pixels
    expect(chart.getDatasetMeta(0).controller._plan).toBe(plan)
    const after = chart.getDatasetMeta(0).data.map((f) => [f.x, f.x2, f.y, f.height])
    expect(after).not.toEqual(before)
    const { chartArea } = chart
    const n = union(boxes(chart).nodes)
    expect(n.bottom - n.top).toBeGreaterThanOrEqual(chartArea.bottom - chartArea.top - 2 - 1e-6)
    expect(n.right - n.left).toBeGreaterThanOrEqual(chartArea.right - chartArea.left - 2 - 1e-6)
  })

  it('rebuilds the plan when the data changes', () => {
    const chart = build()
    const plan = chart.getDatasetMeta(0).controller._plan
    chart.data.datasets[0].data = [...data, { flow: 3, from: 'F', to: 'G' }]
    chart.update()
    expect(chart.getDatasetMeta(0).controller._plan).not.toBe(plan)
    expect(chart.getDatasetMeta(0).data.length).toBe(7)
  })

  it('hit-tests flows where they are drawn', () => {
    const chart = build()
    const meta = chart.getDatasetMeta(0)
    meta.data.forEach((flow, i) => {
      const p = flow.getCenterPoint()
      expect(flow.inRange(p.x, p.y, false), `flow ${i}`).toBe(true)
      const hit = chart.getElementsAtEventForMode(
        { native: true, type: 'mousemove', x: p.x, y: p.y },
        'nearest',
        { intersect: true },
        false
      )
      expect(hit.length, `flow ${i}`).toBeGreaterThan(0)
      expect(flow.inRange(p.x, chart.chartArea.bottom + 20, false)).toBe(false)
    })
  })

  it('keeps the tooltip content', () => {
    const chart = build()
    const flow = chart.getDatasetMeta(0).data[0]
    const p = flow.getCenterPoint()
    chart.tooltip.setActiveElements([{ datasetIndex: 0, index: 0 }], p)
    chart.setActiveElements([{ datasetIndex: 0, index: 0 }])
    chart.update()
    expect(chart.tooltip.body[0].lines).toEqual(['A -> C: 10'])
  })

  it('plays the reveal from nothing and finishes with the full flows', () => {
    const chart = build({}, { animation: { duration: 1000 } })
    chart.stop()
    chart.update('reset')
    for (const flow of chart.getDatasetMeta(0).data) expect(flow.progress).toBe(0)
    chart.update()
    expect(animator.running(chart)).toBe(true)
    chart.stop()
    chart.update('none')
    for (const flow of chart.getDatasetMeta(0).data) expect(flow.progress).toBe(1)
  })

  it('keeps the parsed column on the column axis', () => {
    const horizontal = build()
    const parsed = horizontal.getDatasetMeta(0).controller.getParsed(0)
    expect(parsed.x).toBe(0)
    expect(parsed._custom.x).toBe(1)
    const vertical = build({ orientation: 'vertical' })
    const v = vertical.getDatasetMeta(0).controller.getParsed(0)
    expect(v.y).toBe(0)
    expect(v._custom.y).toBe(1)
  })

  it('makes room for labels placed outside the outermost columns', () => {
    const chart = build(
      { nodeLabels: { position: (node) => (node.key === 'A' ? 'left' : 'right') } },
      {}
    )
    const nodes = chart.getDatasetMeta(0).controller._geometry.nodes
    const a = nodes.get('A')
    const e = nodes.get('E')
    expect(a.x).toBeGreaterThan(chart.chartArea.left + 5)
    expect(e.x + e.width).toBeLessThan(chart.chartArea.right - 5)
  })
})
