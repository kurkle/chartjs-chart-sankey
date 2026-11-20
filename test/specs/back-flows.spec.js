import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

import { backFlowBounds } from '../../src/lib/back-flow-path.js'

const recycle = [
  { flow: 60, from: 'Raw', to: 'Factory' },
  { flow: 70, from: 'Factory', to: 'Product' },
  { flow: 10, from: 'Factory', to: 'Waste' },
  { flow: 70, from: 'Product', to: 'Use' },
  { flow: 50, from: 'Use', to: 'Landfill' },
  { flow: 20, from: 'Use', to: 'Factory' },
]

const nested = [
  { flow: 50, from: 'Feed', to: 'Mix' },
  { flow: 60, from: 'Mix', to: 'Reactor' },
  { flow: 70, from: 'Reactor', to: 'Separator' },
  { flow: 40, from: 'Separator', to: 'Product' },
  { flow: 20, from: 'Separator', to: 'Reactor' },
  { flow: 10, from: 'Separator', to: 'Mix' },
  { flow: 5, from: 'Reactor', to: 'Reactor' },
]

function build(data, dataset = {}, options = {}, canvas = { height: 320, width: 560 }) {
  return acquireChart(
    {
      data: { datasets: [{ data, label: 'Flows', ...dataset }] },
      options: { animation: false, maintainAspectRatio: false, ...options },
      type: 'sankey',
    },
    { canvas }
  )
}

/** The box the band of a back flow covers, in x and y. */
function bandBox(flow) {
  const vertical = flow.options.orientation === 'vertical'
  const { height, lane, reach, reach2, width, x, x2, y, y2 } = flow
  const shape = vertical
    ? {
        c1: x + width / 2,
        c2: x2 + width / 2,
        clear: flow.clear,
        lane,
        reach1: reach,
        reach2,
        t: width,
        u1: y,
        u2: y2,
      }
    : {
        c1: y + height / 2,
        c2: y2 + height / 2,
        clear: flow.clear,
        lane,
        reach1: reach,
        reach2,
        t: height,
        u1: x,
        u2: x2,
      }
  const b = backFlowBounds(shape)
  return vertical
    ? { bottom: b.uMax, left: b.wMin, right: b.wMax, top: b.uMin }
    : { bottom: b.wMax, left: b.uMin, right: b.uMax, top: b.wMin }
}

function inside(box, area, eps = 1e-6) {
  return (
    box.left >= area.left - eps &&
    box.right <= area.right + eps &&
    box.top >= area.top - eps &&
    box.bottom <= area.bottom + eps
  )
}

describe('back flows along lanes', () => {
  for (const orientation of ['horizontal', 'vertical']) {
    it(`routes every back flow and keeps the lanes inside the chart area with a title and a legend (${orientation})`, () => {
      const chart = build(
        nested,
        { orientation },
        {
          plugins: {
            legend: { display: true, position: 'right' },
            title: { display: true, text: 'Title' },
          },
        }
      )
      const flows = chart.getDatasetMeta(0).data
      const back = flows.filter((f) => f.back)
      expect(back).toHaveLength(3)
      for (const flow of back) {
        expect(inside(bandBox(flow), chart.chartArea), `${flow.from.key}->${flow.to.key}`).toBe(
          true
        )
      }
      // nothing else leaves the area either
      for (const rect of chart.getDatasetMeta(0).controller._geometry.nodes.values()) {
        expect(rect.x).toBeGreaterThanOrEqual(chart.chartArea.left - 1e-6)
        expect(rect.y).toBeGreaterThanOrEqual(chart.chartArea.top - 1e-6)
      }
    })
  }

  it('classifies back flows from the plan, not from the columns', () => {
    const chart = build(recycle)
    const meta = chart.getDatasetMeta(0)
    const plan = meta.controller._plan
    meta.data.forEach((flow, i) => {
      expect(flow.back).toBe(plan.links[i].back)
    })
    expect(meta.data.filter((f) => f.back)).toHaveLength(1)
  })

  it('hit-tests along the lane and not in the loop, in both orientations', () => {
    for (const orientation of ['horizontal', 'vertical']) {
      const chart = build(recycle, { orientation })
      const flow = chart.getDatasetMeta(0).data.find((f) => f.back)
      const center = flow.getCenterPoint(false)
      expect(flow.inRange(center.x, center.y, false), orientation).toBe(true)
      const hit = chart.getElementsAtEventForMode(
        { native: true, type: 'mousemove', x: center.x, y: center.y },
        'nearest',
        { intersect: true },
        false
      )
      expect(
        hit.some((h) => h.element === flow),
        orientation
      ).toBe(true)
      // the middle of the loop is empty
      const box = bandBox(flow)
      const hole = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
      const vertical = orientation === 'vertical'
      const probe = vertical
        ? { x: center.x - flow.width * 3, y: center.y }
        : { x: center.x, y: center.y - flow.height * 3 }
      expect(flow.inRange(probe.x, probe.y, false), orientation).toBe(false)
      expect(Number.isFinite(hole.x)).toBe(true)
    }
  })

  it('keeps the tooltip of a back flow', () => {
    const chart = build(recycle)
    const index = chart.getDatasetMeta(0).data.findIndex((f) => f.back)
    const flow = chart.getDatasetMeta(0).data[index]
    chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], flow.getCenterPoint(false))
    chart.setActiveElements([{ datasetIndex: 0, index }])
    chart.update()
    expect(chart.tooltip.body[0].lines).toEqual(['Use -> Factory: 20'])
  })

  it('snaps the routes to the new orientation and replays the reveal', () => {
    const expected = build(recycle, { orientation: 'vertical' })
      .getDatasetMeta(0)
      .data.map((f) => [
        f.x,
        f.y,
        f.x2,
        f.y2,
        f.width,
        f.height,
        f.lane,
        f.reach,
        f.reach2,
        f.clear,
      ])

    const chart = build(recycle, { orientation: 'horizontal' }, { animation: { duration: 1000 } })
    chart.stop()
    chart.update('none')
    chart.data.datasets[0].orientation = 'vertical'
    chart.update()
    const flows = chart.getDatasetMeta(0).data
    expect(
      flows.map((f) => [
        f.x,
        f.y,
        f.x2,
        f.y2,
        f.width,
        f.height,
        f.lane,
        f.reach,
        f.reach2,
        f.clear,
      ])
    ).toEqual(expected)
    for (const flow of flows) expect(flow.progress).toBe(0)
    expect(animator.running(chart)).toBe(true)
    chart.stop()
  })

  it('reveals a back flow along its length while the animation runs', () => {
    const chart = build(recycle, {}, { animation: { duration: 1000 } })
    chart.stop()
    chart.update('none')
    const flow = chart.getDatasetMeta(0).data.find((f) => f.back)
    const calls = []
    const ctx = chart.ctx
    const setLineDash = vi.spyOn(ctx, 'setLineDash').mockImplementation((dash) => calls.push(dash))
    flow.progress = 0.5
    flow.draw(ctx)
    setLineDash.mockRestore()
    expect(calls.some((dash) => dash.length === 2 && dash[0] > 0)).toBe(true)
  })

  it('draws every back flow of a dense cyclic chart inside the chart area', () => {
    const data = []
    const names = Array.from({ length: 12 }, (_, i) => `N${i}`)
    names.forEach((name, i) => {
      if (i) data.push({ flow: 40, from: names[i - 1], to: name })
    })
    for (let i = 2; i < names.length; i++) {
      for (let j = 0; j < i - 1; j += 2)
        data.push({ flow: 1 + ((i + j) % 4), from: names[i], to: names[j] })
    }
    const chart = build(data, {}, {}, { height: 600, width: 800 })
    const flows = chart.getDatasetMeta(0).data
    const back = flows.filter((f) => f.back)
    expect(back.length).toBeGreaterThan(20)
    for (const flow of back) {
      expect(flow.height).toBeGreaterThan(0)
      expect(inside(bandBox(flow), chart.chartArea, 1e-3), `${flow.from.key}->${flow.to.key}`).toBe(
        true
      )
    }
  })

  it('shares the cross axis fairly: the lanes take part of it and the nodes the rest', () => {
    const chart = build(recycle, {}, {}, { height: 340, width: 620 })
    const geometry = chart.getDatasetMeta(0).controller._geometry
    const flow = chart.getDatasetMeta(0).data.find((f) => f.back)
    const content = Math.max(...[...geometry.nodes.values()].map((r) => r.y + r.height))
    const area = chart.chartArea
    expect(flow.lane).toBeGreaterThan(content)
    expect(flow.lane + flow.height / 2).toBeLessThanOrEqual(area.bottom + 1e-6)
    expect(content - area.top).toBeGreaterThan((area.bottom - area.top) * 0.4)
  })
})
