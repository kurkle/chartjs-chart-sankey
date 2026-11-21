import { Interaction } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

// A flow thinner than 3 CSS pixels is hit within a pixel and a half of its center line,
// and where the areas of flows meet, the flow whose band is nearest to the mouse is the
// one found. These tests go through the default interaction mode of the chart.
const data = [
  { flow: 1000, from: 'A', to: 'B' },
  { flow: 600, from: 'A', to: 'C' },
  { flow: 700, from: 'B', to: 'D' },
  { flow: 500, from: 'C', to: 'D' },
  { flow: 600, from: 'D', to: 'E' },
  // thinner than a pixel: next to thick flows, across a skipped column, a lane, a loop of one node
  { flow: 3, from: 'B', to: 'E' },
  { flow: 4, from: 'C', to: 'E' },
  { flow: 2, from: 'A', to: 'D' },
  { flow: 3, from: 'E', to: 'A' },
  { flow: 2, from: 'D', to: 'D' },
  { flow: 4, from: 'E', to: 'B' },
]
const WIDTH = 300
const HEIGHT = 200
const RATIO = 3

function build(orientation) {
  return acquireChart(
    {
      data: { datasets: [{ data, flowColor: 'rgb(0, 0, 0)', nodeWidth: 10, orientation }] },
      options: {
        animation: false,
        devicePixelRatio: RATIO,
        maintainAspectRatio: false,
        responsive: false,
      },
      type: 'sankey',
    },
    { canvas: { height: HEIGHT, width: WIDTH } }
  )
}

// The alpha of the canvas for every flow drawn alone, by device pixel.
function paintAll(chart) {
  const { canvas, ctx } = chart
  const { width, height } = canvas
  return chart.getDatasetMeta(0).data.map((flow) => {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.restore()
    flow.draw(ctx)
    const { data: pixels } = ctx.getImageData(0, 0, width, height)
    return Uint8Array.from({ length: width * height }, (_, i) => pixels[i * 4 + 3])
  })
}

// What the chart finds at a point in CSS pixels, with the mode it has by default.
function found(chart, x, y) {
  const { interaction } = chart.options
  return chart
    .getElementsAtEventForMode({ native: true, x, y }, interaction.mode, interaction, false)
    .map((item) => item.index)
}

// The device pixel and the ones one pixel away on each side are painted (or none of them).
function painted(alpha, width, px, py, all) {
  const cells = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  const values = cells.map(([dx, dy]) => alpha[(py + dy) * width + px + dx])
  return all ? values.every((v) => v === 255) : values.some((v) => v > 0)
}

// Samples of the center line of a route in (u, w), with the direction across it: along its curves
// and runs for a band, along the middle of the straight runs for a lane (its corners are round).
function centerLine({ points, radius, radius2, t }) {
  const center = []
  const steps = Array.from({ length: 8 }, (_, k) => 0.15 + k * 0.1)
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]]
    for (const step of steps) {
      if (radius === undefined && i % 2 === 0) {
        // a curve between two columns: the control points are at 2/3 and 1/3
        const u = a.u + (b.u - a.u) * (2 * step - 3 * step ** 2 + 2 * step ** 3)
        const w = a.w + (b.w - a.w) * (3 * step ** 2 - 2 * step ** 3)
        center.push([u, w + t / 2, 0, 1])
        continue
      }
      const length = Math.hypot(b.u - a.u, b.w - a.w)
      const corner = radius === undefined ? 0 : Math.max(radius, radius2 ?? 0)
      const from = i > 0 ? corner : 0
      const to = i < points.length - 2 ? length - corner : length
      if (to <= from) continue
      const at = from + (to - from) * step
      const u = a.u + ((b.u - a.u) * at) / length
      const w = a.w + ((b.w - a.w) * at) / length
      if (radius === undefined) center.push([u, w + t / 2, 0, 1])
      else center.push(Math.abs(a.u - b.u) < 1e-9 ? [u, w, 1, 0] : [u, w, 0, 1])
    }
  }
  return center
}

describe('hit area of thin flows', () => {
  it('registers the interaction mode of the chart', () => {
    const chart = build('horizontal')
    expect(chart.options.interaction.mode).toBe('sankey')
    expect(typeof Interaction.modes.sankey).toBe('function')
  })

  for (const orientation of ['horizontal', 'vertical']) {
    describe(orientation, () => {
      it('has flows thinner than a pixel next to thick ones', () => {
        const flows = build(orientation).getDatasetMeta(0).data
        expect(flows.filter((flow) => flow.route.t < 1).length).toBeGreaterThanOrEqual(5)
        expect(flows.filter((flow) => flow.route.t > 10).length).toBeGreaterThanOrEqual(3)
        expect(flows.some((flow) => flow.back && flow.route.t < 3)).toBe(true)
      })

      it('gives every settled painted pixel of a flow to that flow', () => {
        const chart = build(orientation)
        const { width } = chart.canvas
        const height = chart.canvas.height
        const alphas = paintAll(chart)
        let checked = 0
        alphas.forEach((alpha, index) => {
          for (let py = 1; py < height - 1; py += 2) {
            for (let px = 1; px < width - 1; px += 2) {
              if (!painted(alpha, width, px, py, true)) continue
              // no other flow is painted here
              if (alphas.some((other, i) => i !== index && painted(other, width, px, py, false)))
                continue
              checked++
              const got = found(chart, (px + 0.5) / RATIO, (py + 0.5) / RATIO)
              if (got.length !== 1 || got[0] !== index) {
                expect({ got, index, px, py }).toEqual({ got: [index], index, px, py })
              }
            }
          }
        })
        expect(checked).toBeGreaterThan(1000)
      })

      it('hits a thin flow within 1.4 px of its center line where no other flow is painted', () => {
        const chart = build(orientation)
        const { width } = chart.canvas
        const alphas = paintAll(chart)
        const flows = chart.getDatasetMeta(0).data
        const vertical = orientation === 'vertical'
        const thin = flows.filter((flow) => flow.route.t < 1)
        expect(thin.length).toBeGreaterThanOrEqual(5)
        let checked = 0
        for (const flow of thin) {
          const index = flows.indexOf(flow)
          const center = centerLine(flow.route)
          for (const [u, w, du, dw] of center) {
            // the sample is on the flow: the corners of a lane are left out
            const [cx, cy] = vertical ? [w, u] : [u, w]
            if (alphas[index][Math.floor(cy * RATIO) * width + Math.floor(cx * RATIO)] === 0)
              continue
            for (const sign of [-1, 1]) {
              // across the line: along w for a band and a run of a lane, along u for a run across
              const [pu, pw] = [u + du * sign * 1.4, w + dw * sign * 1.4]
              const [x, y] = vertical ? [pw, pu] : [pu, pw]
              const [px, py] = [Math.floor(x * RATIO), Math.floor(y * RATIO)]
              if (px < 1 || py < 1 || px >= width - 1 || py >= chart.canvas.height - 1) continue
              if (alphas.some((other, i) => i !== index && painted(other, width, px, py, false)))
                continue
              // another thin flow close by can be the nearer one
              if (
                flows.some(
                  (other, i) =>
                    i !== index && other.distance(x, y, false) <= flow.distance(x, y, false)
                )
              )
                continue
              checked++
              const got = found(chart, x, y)
              expect({ got, index, x, y }).toEqual({ got: [index], index, x, y })
            }
          }
        }
        expect(checked).toBeGreaterThan(40)
      })

      it('lets the nearest flow win where the areas of two flows meet', () => {
        const chart = build(orientation)
        const flows = chart.getDatasetMeta(0).data
        let overlaps = 0
        for (let y = 2; y < HEIGHT; y += 0.7) {
          for (let x = 2; x < WIDTH; x += 0.7) {
            const hit = flows
              .map((flow, i) => [i, flow])
              .filter(([, flow]) => flow.inRange(x, y, false))
            if (hit.length < 2) continue
            overlaps++
            const nearest = hit.reduce((a, b) =>
              b[1].distance(x, y, false) < a[1].distance(x, y, false) ? b : a
            )
            const bands = hit.map(([, flow]) => flow.distance(x, y, false))
            if (bands.filter((d) => d === Math.min(...bands)).length > 1) continue
            expect(found(chart, x, y)).toEqual([nearest[0]])
          }
        }
        expect(overlaps).toBeGreaterThan(200)
      })

      it('keeps the wider areas in the nearest mode of Chart.js', () => {
        const chart = build(orientation)
        const flows = chart.getDatasetMeta(0).data
        const thin = flows.find((flow) => flow.route.t < 1 && !flow.back)
        const { x, y } = thin.getCenterPoint(false)
        const off = orientation === 'vertical' ? [x + 1.2, y] : [x, y + 1.2]
        expect(thin.inRange(...off, false)).toBe(true)
        const items = chart.getElementsAtEventForMode(
          { native: true, x: off[0], y: off[1] },
          'nearest',
          { intersect: true },
          false
        )
        expect(items.length).toBe(1)
      })
    })
  }
})
