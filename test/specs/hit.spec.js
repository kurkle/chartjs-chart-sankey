import { acquireChart } from 'chartjs-test-utils'

// A flow is hit exactly where it is painted. The hit test asks the canvas about
// the path that `draw` traces, so these tests compare the answer of `inRange`
// with the pixels a flow leaves on the canvas, at several device pixel ratios.
const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'D' },
  { flow: 4, from: 'C', to: 'A' },
  { flow: 3, from: 'D', to: 'B' },
  { flow: 5, from: 'A', to: 'D' },
]
const WIDTH = 300
const HEIGHT = 200

function build(devicePixelRatio, orientation, animation = false) {
  return acquireChart(
    {
      data: {
        datasets: [{ data, flowColor: 'rgb(0, 0, 0)', nodeWidth: 10, orientation }],
      },
      options: { animation, devicePixelRatio, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas: { height: HEIGHT, width: WIDTH } }
  )
}

// A flow is back when it runs against the direction of the columns.
const isBack = (flow, orientation) =>
  orientation === 'vertical' ? flow.y2 < flow.y : flow.x2 < flow.x

// A reader of the alpha of the canvas at a point given in CSS pixels.
function alphaReader(chart) {
  const ratio = chart.currentDevicePixelRatio
  const { data, width } = chart.ctx.getImageData(0, 0, chart.canvas.width, chart.canvas.height)
  return (x, y) => data[(Math.floor(y * ratio) * width + Math.floor(x * ratio)) * 4 + 3]
}

// Sample points in CSS pixels, off the pixel centers of every device pixel ratio.
function* grid() {
  for (let y = 0.5; y < HEIGHT; y += 2.5) {
    for (let x = 0.5; x < WIDTH; x += 2.5) yield [x, y]
  }
}

// Draws one flow alone on a cleared canvas.
function drawAlone(chart, flow) {
  const { canvas, ctx } = chart
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  flow.draw(ctx)
}

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

// Whether the canvas is clearly painted (255), clearly empty (0) or on an antialiased edge (undefined).
const state = (alpha) => (alpha === 255 || alpha === 0 ? alpha === 255 : undefined)

// Whether the point is clearly painted or clearly empty, with the same state a CSS pixel
// away on each side: the antialiasing and the half pixel stroke blur the edge.
function settled(alphaAt, x, y) {
  const here = state(alphaAt(x, y))
  return (
    here !== undefined && NEIGHBORS.every(([dx, dy]) => state(alphaAt(x + dx, y + dy)) === here)
  )
}

// Compares `inRange` with the painted alpha away from the edge.
function compare(chart, flow) {
  drawAlone(chart, flow)
  const alphaAt = alphaReader(chart)
  const points = [...grid()].filter(([x, y]) => settled(alphaAt, x, y))
  const answers = points.map(([x, y]) => ({
    hit: flow.inRange(x, y, false),
    painted: alphaAt(x, y) === 255,
  }))
  return {
    checked: answers.length,
    hitUnpainted: answers.filter((a) => a.hit && !a.painted).length,
    missedPainted: answers.filter((a) => !a.hit && a.painted).length,
    painted: answers.filter((a) => a.painted).length,
  }
}

// A painted point with a painted point on each side of it.
function interiorPoint(chart, accept) {
  const alphaAt = alphaReader(chart)
  return [...grid()].find(
    ([x, y]) =>
      alphaAt(x, y) === 255 &&
      accept(x, y) &&
      NEIGHBORS.every(([dx, dy]) => alphaAt(x + dx * 2, y + dy * 2) === 255)
  )
}

const cases = ['horizontal', 'vertical'].flatMap((orientation) =>
  [1, 2, 3].map((ratio) => ({ orientation, ratio }))
)

describe('hit test', () => {
  for (const { orientation, ratio } of cases) {
    describe(`${orientation}, device pixel ratio ${ratio}`, () => {
      it('has a back flow to test', () => {
        const chart = build(ratio, orientation)
        expect(chart.currentDevicePixelRatio).toBe(ratio)
        const flows = chart.getDatasetMeta(0).data
        expect(flows.some((flow) => isBack(flow, orientation))).toBe(true)
      })

      it('hits a flow where it is painted and nowhere else', () => {
        const chart = build(ratio, orientation)
        for (const flow of chart.getDatasetMeta(0).data) {
          const { checked, hitUnpainted, missedPainted, painted } = compare(chart, flow)
          expect(painted).toBeGreaterThan(50)
          expect(checked).toBeGreaterThan(painted)
          expect({ hitUnpainted, missedPainted }).toEqual({ hitUnpainted: 0, missedPainted: 0 })
        }
      })

      it('finds a flow through the chart at a point only it covers', () => {
        const chart = build(ratio, orientation)
        const flows = chart.getDatasetMeta(0).data
        for (const flow of flows) {
          drawAlone(chart, flow)
          const [x, y] = interiorPoint(chart, (px, py) =>
            flows.every((other) => other === flow || !other.inRange(px, py, false))
          )
          const hits = chart.getElementsAtEventForMode(
            { native: true, x, y },
            'nearest',
            { intersect: true },
            false
          )
          expect(hits.map((hit) => hit.index)).toEqual([flows.indexOf(flow)])
        }
      })

      it('leaves the drawing alone', () => {
        const chart = build(ratio, orientation)
        const before = chart.canvas.toDataURL()
        for (const flow of chart.getDatasetMeta(0).data) {
          for (const [x, y] of [...grid()].filter((_, i) => i % 97 === 0)) flow.inRange(x, y, false)
        }
        expect(chart.canvas.toDataURL()).toBe(before)
        chart.draw()
        expect(chart.canvas.toDataURL()).toBe(before)
      })
    })
  }

  it('does not animate the context the flows ask', () => {
    const chart = build(1, 'horizontal', { duration: 500 })
    const ctx = chart.ctx
    for (const flow of chart.getDatasetMeta(0).data) {
      expect(flow.ctx).toBe(ctx)
      expect(flow.$animations?.ctx).toBeUndefined()
    }
    chart.data.datasets[0].data = [...data, { flow: 2, from: 'B', to: 'C' }]
    chart.update()
    for (const flow of chart.getDatasetMeta(0).data) {
      expect(flow.ctx).toBe(ctx)
      expect(flow.$animations?.ctx).toBeUndefined()
    }
  })

  it('hits a back flow at its painted band', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const chart = build(1, orientation)
      const back = chart.getDatasetMeta(0).data.filter((flow) => isBack(flow, orientation))
      expect(back.length).toBeGreaterThan(0)
      for (const flow of back) {
        const { hitUnpainted, missedPainted, painted } = compare(chart, flow)
        expect(painted).toBeGreaterThan(0)
        expect(missedPainted).toBe(0)
        expect(hitUnpainted).toBe(0)
      }
    }
  })
})
