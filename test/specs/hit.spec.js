import { acquireChart } from 'chartjs-test-utils'

// A flow is hit exactly where it is painted. The hit test is worked out from the
// route of the flow, with no canvas, so these tests compare the answer of
// `inRange` with the pixels a flow leaves on the canvas, at several device pixel
// ratios, for every shape of route the layout makes.
const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'D' },
  { flow: 4, from: 'C', to: 'A' },
  { flow: 3, from: 'D', to: 'B' },
  { flow: 5, from: 'A', to: 'D' },
]

// The shapes of route: a forward band that skips columns (straight runs across
// them), lanes, a flow to the node itself, lanes in a bundle with a second
// radius at the target, and lanes before the content.
const recycling = [
  { flow: 60, from: 'Raw', to: 'Factory' },
  { flow: 70, from: 'Factory', to: 'Product' },
  { flow: 10, from: 'Factory', to: 'Waste' },
  { flow: 70, from: 'Product', to: 'Use' },
  { flow: 50, from: 'Use', to: 'Landfill' },
  { flow: 20, from: 'Use', to: 'Factory' },
  { flow: 8, from: 'Product', to: 'Factory' },
  { flow: 15, from: 'Raw', to: 'Use' },
  { flow: 4, from: 'Use', to: 'Use' },
]
// two back flows leave Use, and two flows from D go back to B
const leaving = [...recycling, { flow: 12, from: 'Use', to: 'Product' }]
const parallel = [
  { flow: 30, from: 'A', to: 'B' },
  { flow: 30, from: 'B', to: 'C' },
  { flow: 30, from: 'C', to: 'D' },
  { flow: 8, from: 'D', to: 'B' },
  { flow: 6, from: 'D', to: 'B' },
  { flow: 5, from: 'C', to: 'B' },
  { flow: 4, from: 'D', to: 'A' },
]
const shapes = {
  'bundled lanes with a second radius': { backFlows: { bundle: 'target' }, data: recycling },
  'lanes before the content': { backFlows: { side: 'start' }, data: recycling },
  'lanes shared by source, with a wider turn at the source': {
    backFlows: { bundle: 'source' },
    data: leaving,
  },
  'lanes, a skipped column and a flow to the node itself': { data: recycling },
  'two ends of the same column': { data },
  'two flows between the same nodes in one lane': { data: parallel },
}
const WIDTH = 300
const HEIGHT = 200

function build(devicePixelRatio, orientation, animation = false, dataset = { data }) {
  return acquireChart(
    {
      data: {
        datasets: [{ flowColor: 'rgb(0, 0, 0)', nodeWidth: 10, orientation, ...dataset }],
      },
      options: { animation, devicePixelRatio, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas: { height: HEIGHT, width: WIDTH } }
  )
}

// A flow is back when it is routed along a lane.
const isBack = (flow) => flow.back

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

// Compares `inRange` with the painted alpha at every device pixel of the canvas whose
// state (painted or empty) is the same one device pixel away on each side. Thin bands
// have such pixels at a high device pixel ratio even when no point of a coarse grid in
// CSS pixels falls on them.
function compareDevicePixels(chart, flow) {
  drawAlone(chart, flow)
  const ratio = chart.currentDevicePixelRatio
  const { width, height } = chart.canvas
  const { data } = chart.ctx.getImageData(0, 0, width, height)
  const at = (px, py) => state(data[(py * width + px) * 4 + 3])
  // only around what is painted: the flow answers false far from it, which `bounds` settles
  let [x0, x1, y0, y1] = [width, -1, height, -1]
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) continue
    const [px, py] = [(i >> 2) % width, Math.floor(i / 4 / width)]
    x0 = Math.min(x0, px)
    x1 = Math.max(x1, px)
    y0 = Math.min(y0, py)
    y1 = Math.max(y1, py)
  }
  const margin = 4
  let hitUnpainted = 0
  let missedPainted = 0
  let painted = 0
  for (let py = Math.max(1, y0 - margin); py < Math.min(height - 1, y1 + margin + 1); py++) {
    for (let px = Math.max(1, x0 - margin); px < Math.min(width - 1, x1 + margin + 1); px++) {
      const here = at(px, py)
      if (here === undefined || NEIGHBORS.some(([dx, dy]) => at(px + dx, py + dy) !== here))
        continue
      if (here) painted++
      const hit = flow.inRange((px + 0.5) / ratio, (py + 0.5) / ratio, false)
      if (hit && !here) hitUnpainted++
      if (!hit && here) missedPainted++
    }
  }
  // and far from it, every few pixels, nothing is hit
  for (let py = 1; py < height - 1; py += 7) {
    for (let px = 1; px < width - 1; px += 7) {
      if (at(px, py) === false && flow.inRange((px + 0.5) / ratio, (py + 0.5) / ratio, false)) {
        hitUnpainted++
      }
    }
  }
  return { hitUnpainted, missedPainted, painted }
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
        expect(flows.some((flow) => isBack(flow))).toBe(true)
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

      it('finds every flow at its center and nowhere else', () => {
        const chart = build(ratio, orientation)
        const flows = chart.getDatasetMeta(0).data
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

  for (const orientation of ['horizontal', 'vertical']) {
    for (const [name, dataset] of Object.entries(shapes)) {
      it(`hits a flow where it is painted, for ${name} (${orientation})`, () => {
        const chart = build(3, orientation, false, { ...dataset })
        expect(chart.currentDevicePixelRatio).toBe(3)
        for (const flow of chart.getDatasetMeta(0).data) {
          const { hitUnpainted, missedPainted, painted } = compareDevicePixels(chart, flow)
          expect(painted).toBeGreaterThan(0)
          expect({ hitUnpainted, missedPainted }).toEqual({ hitUnpainted: 0, missedPainted: 0 })
        }
      })
    }

    it(`has the shapes it claims to test (${orientation})`, () => {
      const routes = (dataset) =>
        build(1, orientation, false, dataset)
          .getDatasetMeta(0)
          .data.map((flow) => flow.route)
      const bundled = routes(shapes['bundled lanes with a second radius'])
      expect(
        bundled.some((route) => route.radius2 !== undefined && route.radius2 > route.radius)
      ).toBe(true)
      const sourced = routes(shapes['lanes shared by source, with a wider turn at the source'])
      expect(
        sourced.some((route) => route.radius !== undefined && route.radius > (route.radius2 ?? 0))
      ).toBe(true)
      const skipping = routes({ data: recycling })
      expect(skipping.some((route) => route.radius === undefined && route.points.length > 2)).toBe(
        true
      )
      expect(skipping.some((route) => route.radius !== undefined)).toBe(true)
      // a lane before the content is nearer to the start of the cross axis than one after it
      const laneAt = (dataset) =>
        build(1, orientation, false, dataset)
          .getDatasetMeta(0)
          .data.find((flow) => flow.back).route.points[2].w
      expect(laneAt(shapes['lanes before the content'])).toBeLessThan(laneAt({ data: recycling }))
    })
  }

  it('hits a flow made without a chart', () => {
    const [flow] = build(1, 'horizontal').getDatasetMeta(0).data
    const alone = new flow.constructor({
      flow: 1,
      height: 10,
      options: flow.options,
      x: 0,
      x2: 100,
      y: 0,
      y2: 0,
    })
    expect(alone.inRange(50, 5, false)).toBe(true)
    expect(alone.inRange(50, 20, false)).toBe(false)
  })

  it('hits a back flow at its painted band', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const chart = build(1, orientation)
      const back = chart.getDatasetMeta(0).data.filter((flow) => isBack(flow))
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
