import { acquireChart } from 'chartjs-test-utils'

const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'D' },
  { flow: 4, from: 'C', to: 'A' },
]

function build(devicePixelRatio, orientation) {
  return acquireChart(
    {
      data: { datasets: [{ data, orientation }] },
      options: { animation: false, devicePixelRatio, maintainAspectRatio: false },
      type: 'sankey',
    },
    { canvas: { height: 200, width: 300 } }
  )
}

describe('hit test', () => {
  for (const orientation of ['horizontal', 'vertical']) {
    for (const ratio of [1, 2, 3]) {
      it(`finds every flow at its center and nowhere else, at device pixel ratio ${ratio} (${orientation})`, () => {
        const chart = build(ratio, orientation)
        expect(chart.currentDevicePixelRatio).toBe(ratio)
        const flows = chart.getDatasetMeta(0).data
        expect(flows.some((flow) => flow.back)).toBe(true)
        for (const flow of flows) {
          const { x, y } = flow.getCenterPoint(false)
          expect(flow.inRange(x, y, false)).toBe(true)
          // only the flow the point is on answers
          expect(flows.filter((other) => other.inRange(x, y, false))).toEqual([flow])
          expect(
            chart.getElementsAtEventForMode(
              { native: true, x, y },
              'nearest',
              { intersect: true },
              false
            )[0].element
          ).toBe(flow)
        }
        expect(flows.some((flow) => flow.inRange(1, 1, false))).toBe(false)
      })

      it(`leaves the drawing alone, at device pixel ratio ${ratio} (${orientation})`, () => {
        const chart = build(ratio, orientation)
        const before = chart.canvas.toDataURL()
        for (const flow of chart.getDatasetMeta(0).data) flow.inRange(150, 100, false)
        chart.draw()
        expect(chart.canvas.toDataURL()).toBe(before)
      })
    }
  }
})
