import { acquireChart } from 'chartjs-test-utils'

import { backFlowParts, backFlowPath } from '../../src/lib/back-flow-path.js'

// Every fixture config is laid out and every flow that goes forward is checked
// against the node bars: a band may touch its own two ends and nothing else.
const configs = import.meta.glob('../fixtures/**/*.js', { eager: true, import: 'default' })

const cubic = (p0, p1, p2, p3, t) => {
  const m = 1 - t
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3
}

/** Samples of a band as {u, w0, w1} (top and bottom edge) along the columns, in (u, w). */
function band(flow) {
  const vertical = flow.options.orientation === 'vertical'
  const t = vertical ? flow.width : flow.height
  const uw = (p) => (vertical ? { u: p.y, w: p.x } : { u: p.x, w: p.y })
  const pts = (
    flow.points ?? [
      { x: flow.x, y: flow.y },
      { x: flow.x2, y: flow.y2 },
    ]
  ).map(uw)
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const curve = flow.points ? i % 2 === 0 : true
    const n = curve ? 40 : 2
    for (let s = 0; s <= n; s++) {
      const f = s / n
      const du = b.u - a.u
      const w = curve ? cubic(a.w, a.w, b.w, b.w, f) : a.w + (b.w - a.w) * f
      // same curve as drawn: control points at 2/3 and 1/3 of the way along u
      const u = curve ? cubic(a.u, a.u + (2 / 3) * du, a.u + du / 3, b.u, f) : a.u + du * f
      out.push({ u, w0: w, w1: w + t })
    }
  }
  return out
}

function nodeHits(chart) {
  const meta = chart.getDatasetMeta(0)
  const rects = [...meta.controller._geometry.nodes.entries()]
  const vertical = meta.data[0]?.options.orientation === 'vertical'
  const hits = []
  for (const flow of meta.data.filter((f) => f.from && f.to && f.from.x < f.to.x)) {
    const samples = band(flow)
    for (const [key, r] of rects) {
      if (key === flow.from.key || key === flow.to.key) continue
      const u0 = vertical ? r.y : r.x
      const u1 = vertical ? r.y + r.height : r.x + r.width
      const w0 = vertical ? r.x : r.y
      const w1 = vertical ? r.x + r.width : r.y + r.height
      if (
        samples.some((s) => s.u > u0 + 0.5 && s.u < u1 - 0.5 && s.w1 > w0 + 0.5 && s.w0 < w1 - 0.5)
      ) {
        hits.push(`${flow.from.key} -> ${flow.to.key} over ${key}`)
      }
    }
  }
  return hits
}

/** Points covering the area of a lane band, in (u, w): straight runs and turns, sampled across the band. */
function laneArea(flow, vertical) {
  const { clear, height, lane, reach, width, x, x2, y, y2 } = flow
  const t = vertical ? width : height
  const shape = vertical
    ? { c1: x + width / 2, c2: x2 + width / 2, clear, lane, reach, t, u1: y, u2: y2 }
    : { c1: y + height / 2, c2: y2 + height / 2, clear, lane, reach, t, u1: x, u2: x2 }
  const points = []
  const across = Math.max(2, Math.ceil(t / 3))
  for (const part of backFlowParts(backFlowPath(shape))) {
    for (let i = 0; i <= 24; i++) {
      const f = i / 24
      for (let j = 0; j <= across; j++) {
        const d = (j / across - 0.5) * t
        if (part.type === 'line') {
          // runs are axis aligned: the band is the run widened across its direction
          const horizontalRun = part.from.w === part.to.w
          points.push({
            u: part.from.u + (part.to.u - part.from.u) * f + (horizontalRun ? 0 : d),
            w: part.from.w + (part.to.w - part.from.w) * f + (horizontalRun ? d : 0),
          })
        } else {
          const a = part.start + part.sweep * f
          const r = part.radius + d
          points.push({ u: part.center.u + Math.cos(a) * r, w: part.center.w + Math.sin(a) * r })
        }
      }
    }
  }
  return points
}

/** Lane bands that run over a node bar other than the two they connect. */
function laneHits(chart) {
  const meta = chart.getDatasetMeta(0)
  const rects = [...meta.controller._geometry.nodes.entries()]
  const vertical = meta.data[0]?.options.orientation === 'vertical'
  const hits = []
  for (const flow of meta.data.filter((f) => f.back && (vertical ? f.width : f.height) > 0)) {
    const points = laneArea(flow, vertical)
    for (const [key, r] of rects) {
      if (key === flow.from.key || key === flow.to.key) continue
      const u0 = (vertical ? r.y : r.x) + 0.5
      const u1 = (vertical ? r.y + r.height : r.x + r.width) - 0.5
      const w0 = (vertical ? r.x : r.y) + 0.5
      const w1 = (vertical ? r.x + r.width : r.y + r.height) - 0.5
      if (points.some((p) => p.u > u0 && p.u < u1 && p.w > w0 && p.w < w1)) {
        hits.push(`${flow.from.key} -> ${flow.to.key} over ${key}`)
      }
    }
  }
  return hits
}

describe('flows and node bars', () => {
  for (const [path, json] of Object.entries(configs)) {
    const name = path.replace('../fixtures/', '').replace(/\.js$/, '')
    if (!json.config?.data?.datasets?.[0]?.data?.length) continue
    it(`no forward flow runs over a node it does not connect: ${name}`, () => {
      const config = json.config
      config.options = { plugins: false, ...config.options, animation: false }
      const chart = acquireChart(config, json.options)
      expect(nodeHits(chart)).toEqual([])
    })

    it(`no lane band runs over a node it does not connect: ${name}`, () => {
      const config = json.config
      config.options = { plugins: false, ...config.options, animation: false }
      const chart = acquireChart(config, json.options)
      expect(laneHits(chart)).toEqual([])
    })
  }

  it('draws a skipping flow as one band through its waypoints, straight across the skipped column', () => {
    const chart = acquireChart(
      {
        data: {
          datasets: [
            {
              data: [
                { flow: 10, from: 'A', to: 'B' },
                { flow: 10, from: 'B', to: 'C' },
                { flow: 10, from: 'C', to: 'D' },
                { flow: 6, from: 'A', to: 'D' },
              ],
            },
          ],
        },
        options: { animation: false, maintainAspectRatio: false },
        type: 'sankey',
      },
      { canvas: { height: 240, width: 480 } }
    )
    const flow = chart.getDatasetMeta(0).data[3]
    expect(flow.points).toHaveLength(6)
    // the run across a skipped column is straight and as wide as a node
    expect(flow.points[1].y).toBe(flow.points[2].y)
    expect(flow.points[3].y).toBe(flow.points[4].y)
    expect(flow.points[2].x - flow.points[1].x).toBeCloseTo(10, 5)
    // hit testing follows the band, also over a skipped column
    const mid = flow.getCenterPoint(false)
    expect(flow.inRange(mid.x, mid.y, false)).toBe(true)
    expect(flow.inRange(mid.x, mid.y + 100, false)).toBe(false)
    const hit = chart.getElementsAtEventForMode(
      { native: true, type: 'mousemove', x: mid.x, y: mid.y },
      'nearest',
      { intersect: true },
      false
    )
    expect(hit.some((h) => h.index === 3)).toBe(true)
    // the reveal clips along the column axis
    const clip = vi.spyOn(chart.ctx, 'clip')
    flow.progress = 0.5
    flow.draw(chart.ctx)
    expect(clip).toHaveBeenCalled()
    clip.mockRestore()
  })

  it('keeps the tooltip of a skipping flow and tweens its points on data updates', () => {
    const chart = acquireChart(
      {
        data: {
          datasets: [
            {
              data: [
                { flow: 10, from: 'A', to: 'B' },
                { flow: 10, from: 'B', to: 'C' },
                { flow: 6, from: 'A', to: 'C' },
              ],
            },
          ],
        },
        options: { animation: false, maintainAspectRatio: false },
        type: 'sankey',
      },
      { canvas: { height: 240, width: 480 } }
    )
    const index = 2
    const flow = chart.getDatasetMeta(0).data[index]
    chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], flow.getCenterPoint(false))
    chart.setActiveElements([{ datasetIndex: 0, index }])
    chart.update()
    expect(chart.tooltip.body[0].lines).toEqual(['A -> C: 6'])
  })
})
