import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

// Flow geometry (x, y, x2, y2, height, width) only means something together with
// the resolved `orientation`, which switches at once on update. Tweening the
// numbers from the old orientation's coordinates to the new one's therefore
// draws meaningless intermediate frames, so a change of orientation must snap
// the geometry and replay the reveal instead.
const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 5, from: 'A', to: 'D' },
  { flow: 7, from: 'B', to: 'C' },
  { flow: 3, from: 'C', to: 'E' },
  { flow: 9, from: 'D', to: 'E' },
  { flow: 4, from: 'B', to: 'D' },
]
const GEOMETRY = ['x', 'y', 'x2', 'y2', 'height', 'width']

function build(orientation, where, animation) {
  const dataset = { data: [...data] }
  const options = { animation, maintainAspectRatio: false, responsive: false }
  if (where === 'dataset') dataset.orientation = orientation
  else options.orientation = orientation
  return acquireChart(
    { data: { datasets: [dataset] }, options, type: 'sankey' },
    { canvas: { height: 400, width: 600 } }
  )
}

function geometry(chart) {
  return chart.getDatasetMeta(0).data.map((flow) => GEOMETRY.map((key) => flow[key]))
}

function setOrientation(chart, orientation, where) {
  if (where === 'dataset') chart.data.datasets[0].orientation = orientation
  else chart.options.orientation = orientation
}

describe('orientation change on a live chart', () => {
  for (const where of ['dataset', 'chart']) {
    for (const [from, to] of [
      ['horizontal', 'vertical'],
      ['vertical', 'horizontal'],
    ]) {
      it(`snaps flow geometry and replays the reveal (${from} -> ${to}, set on ${where})`, () => {
        const expected = geometry(build(to, where, false))

        const chart = build(from, where, { duration: 1000 })
        chart.stop()
        chart.update('none')
        for (const flow of chart.getDatasetMeta(0).data) expect(flow.progress).toBe(1)

        setOrientation(chart, to, where)
        chart.update()

        const flows = chart.getDatasetMeta(0).data
        expect(flows.every((flow) => flow.options.orientation === to)).toBe(true)
        // Final geometry straight away, nothing left to tween...
        expect(geometry(chart)).toEqual(expected)
        // ...and the normal reveal is running again from the start.
        for (const flow of flows) expect(flow.progress).toBe(0)
        expect(animator.running(chart)).toBe(true)
        chart.stop()
      })
    }
  }

  it('still tweens geometry on a data update that keeps the orientation', () => {
    const chart = build('horizontal', 'dataset', { duration: 1000 })
    chart.stop()
    chart.update('none')
    const before = geometry(chart)

    chart.data.datasets[0].data = data.map((d, i) => (i === 0 ? { ...d, flow: 30 } : d))
    chart.update()

    const flows = chart.getDatasetMeta(0).data
    expect(geometry(chart)).toEqual(before)
    for (const flow of flows) expect(flow.progress).toBe(1)
    expect(animator.running(chart)).toBe(true)
    chart.stop()
  })
})
