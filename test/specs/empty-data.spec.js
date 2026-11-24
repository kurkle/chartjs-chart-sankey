import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

// A dataset whose data is emptied draws nothing: Chart.js parses no row, so the
// plan of the old data must not be kept.
const rows = [
  { flow: 5, from: 'A', to: 'B' },
  { flow: 3, from: 'B', to: 'C' },
]

function build(animation = false) {
  return acquireChart(
    {
      data: { datasets: [{ data: [...rows] }] },
      options: { animation, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas: { height: 200, width: 300 } }
  )
}

const meta = (chart) => chart.getDatasetMeta(0)

/** How many pixels of the canvas are painted. */
function painted(chart) {
  const { height, width } = chart.canvas
  const pixels = chart.ctx.getImageData(0, 0, width, height).data
  let count = 0
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count++
  return count
}

describe('a dataset whose data is emptied', () => {
  for (const [name, empty] of [
    ['an empty array', []],
    ['null', null],
  ]) {
    it(`keeps no node and paints nothing when the data is replaced by ${name}`, () => {
      const chart = build()
      expect(meta(chart).nodes.length).toBe(3)
      expect(painted(chart)).toBeGreaterThan(0)

      chart.data.datasets[0].data = empty
      chart.update()

      expect(meta(chart).data.length).toBe(0)
      expect(painted(chart)).toBe(0)
      expect(meta(chart).nodes).toEqual([])
    })
  }

  it('places the nodes as new and reveals the flows when the rows come back', () => {
    const chart = build({ duration: 1000 })
    chart.stop()
    chart.data.datasets[0].data = []
    chart.update()
    chart.stop()

    chart.data.datasets[0].data = [...rows]
    chart.update()

    const { controller } = meta(chart)
    const keys = meta(chart).nodes.map((el) => el.node.key)
    expect(keys).toEqual([...controller._plan.nodes.keys()])
    for (const el of meta(chart).nodes) {
      const rect = controller._geometry.nodes.get(el.node.key)
      expect({ height: el.height, width: el.width, x: el.x, y: el.y }).toEqual({ ...rect })
    }
    expect(meta(chart).data.length).toBe(2)
    for (const flow of meta(chart).data) expect(flow.progress).toBe(0)
    expect(animator.running(chart)).toBe(true)
    chart.stop()
  })
})
