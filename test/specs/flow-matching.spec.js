import { animator } from 'chart.js'
import { acquireChart, triggerMouseEvent } from 'chartjs-test-utils'

// When the data is replaced, a flow keeps its element by its key: its source,
// its target and its place among the rows with the same two nodes. A kept flow
// moves from its own old place; a new one is revealed at its own place.
const data = [
  { flow: 10, from: 'S1', to: 'M1' },
  { flow: 6, from: 'S2', to: 'M1' },
  { flow: 14, from: 'S3', to: 'M2' },
  { flow: 4, from: 'S4', to: 'M2' },
  { flow: 10, from: 'M1', to: 'T1' },
  { flow: 6, from: 'M1', to: 'T2' },
  { flow: 4, from: 'M2', to: 'T2' },
  { flow: 14, from: 'M2', to: 'T3' },
]
const GEOMETRY = ['x', 'y', 'x2', 'y2', 'height', 'width', 'route']
const ADDED = { flow: 5, from: 'S0', to: 'M1' }
const ALL = data.map((_, i) => i)

function build({ animation = { duration: 1000 }, dataset = {}, rows = data } = {}) {
  return acquireChart(
    {
      data: { datasets: [{ data: [...rows], nodePadding: 20, ...dataset }] },
      options: { animation, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas: { height: 400, width: 700 } }
  )
}

/** A chart at rest: whatever the first render started has ended. */
function settled(options) {
  const chart = build(options)
  chart.stop()
  chart.update('none')
  return chart
}

const meta = (chart) => chart.getDatasetMeta(0)
const pick = (obj, keys) => Object.fromEntries(keys.map((key) => [key, obj[key]]))
const geometryOf = (flow) => pick(flow, GEOMETRY)
const targetOf = (chart, j) => pick(meta(chart).controller._geometry.flows[j], GEOMETRY)

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
async function frames(count) {
  for (let i = 0; i < count; i++) await frame()
}

/** Replaces the data by a new array and updates with animations. */
function replace(chart, rows) {
  chart.data.datasets[0].data = rows
  chart.update()
}

/**
 * The flow of the old row `keep[j]` is the element of the new row `j`, at its
 * own old geometry right after the update; -1 marks a new row.
 */
function expectKept(chart, old, keep) {
  const elements = meta(chart).data
  expect(elements.length).toBe(keep.length)
  keep.forEach((i, j) => {
    if (i < 0) return
    expect(elements[j]).toBe(old[i].element)
    expect(geometryOf(elements[j])).toEqual(old[i].geometry)
  })
}

/** A new flow is at its own final place, at the start of its reveal. */
function expectRevealed(chart, j, old) {
  const flow = meta(chart).data[j]
  expect(old.some((o) => o.element === flow)).toBe(false)
  expect(geometryOf(flow)).toEqual(targetOf(chart, j))
  expect(flow.progress).toBe(0)
  expect(flow.getProps(['progress'], true).progress).toBe(1)
}

const snapshot = (chart) =>
  meta(chart).data.map((element) => ({ element, geometry: geometryOf(element) }))

describe('flows matched by key across a data replacement', () => {
  it('keeps every flow when a row is inserted in front, and reveals the new one', () => {
    const chart = settled()
    const old = snapshot(chart)

    replace(chart, [ADDED, ...data])

    expectKept(chart, old, [-1, ...ALL])
    expectRevealed(chart, 0, old)
    chart.stop()
  })

  it('keeps the ends of every kept flow on its nodes while they move', async () => {
    const chart = settled()
    replace(chart, [ADDED, ...data])
    const { _geometry: geometry } = meta(chart).controller
    // The offset of the ends from the bars along the columns, at the final place.
    const offsets = meta(chart).data.map((flow, j) => {
      const target = geometry.flows[j]
      const from = geometry.nodes.get(flow.from.key)
      const to = geometry.nodes.get(flow.to.key)
      return { from: target.x - (from.x + from.width), to: target.x2 - to.x }
    })

    await frames(15)
    expect(animator.running(chart)).toBe(true)

    const nodes = new Map(meta(chart).nodes.map((el) => [el.node.key, el]))
    meta(chart).data.forEach((flow, j) => {
      if (j === 0) return
      const from = nodes.get(flow.from.key)
      const to = nodes.get(flow.to.key)
      expect(Math.abs(flow.x - (from.x + from.width) - offsets[j].from)).toBeLessThan(1)
      expect(Math.abs(flow.x2 - to.x - offsets[j].to)).toBeLessThan(1)
      // Within the bars, a pixel either way for the tweens started in separate calls.
      expect(flow.y).toBeGreaterThan(from.y - 1)
      expect(flow.y + flow.height).toBeLessThan(from.y + from.height + 1)
      expect(flow.y2).toBeGreaterThan(to.y - 1)
      expect(flow.y2 + flow.height).toBeLessThan(to.y + to.height + 1)
    })
    chart.stop()
  })

  it('keeps every flow when the rows are reordered', () => {
    const chart = settled()
    const old = snapshot(chart)

    replace(chart, [...data].reverse())

    expectKept(chart, old, [...ALL].reverse())
    chart.stop()
  })

  it('keeps the other flows when the first row is removed', () => {
    const chart = settled()
    const old = snapshot(chart)

    replace(chart, data.slice(1))

    expectKept(chart, old, ALL.slice(1))
    chart.stop()
  })

  it('reveals a new flow that replaces a row, with the number of rows unchanged', () => {
    const chart = settled()
    const old = snapshot(chart)

    replace(chart, data.with(2, { flow: 14, from: 'S3', to: 'M1' }))

    expectKept(chart, old, ALL.with(2, -1))
    expectRevealed(chart, 2, old)
    chart.stop()
  })

  it('matches the rows with the same source and target in data order', () => {
    const rows = [
      { flow: 5, from: 'A', to: 'B' },
      { flow: 4, from: 'A', to: 'C' },
      { flow: 3, from: 'A', to: 'B' },
      { flow: 2, from: 'A', to: 'B' },
      { flow: 8, from: 'B', to: 'D' },
    ]
    const chart = settled({ rows })
    const old = snapshot(chart)

    // The last A -> B is now the first one: it takes the element of the first,
    // the first takes the one of the second, and so on.
    replace(chart, [rows[3], rows[0], rows[1], rows[2], rows[4]])

    expectKept(chart, old, [0, 2, 1, 3, 4])
    chart.stop()
  })

  const direct = {
    "an update with 'none'": [{}, 'none'],
    'animations off': [{ animation: false }, undefined],
  }
  for (const [name, [options, mode]] of Object.entries(direct)) {
    it(`does not reveal a new flow on ${name}`, () => {
      const chart = settled(options)
      const old = snapshot(chart)

      chart.data.datasets[0].data = [ADDED, ...data]
      chart.update(mode)

      const elements = meta(chart).data
      expect(old.some((o) => o.element === elements[0])).toBe(false)
      expect(elements[0].progress).toBe(1)
      for (const i of ALL) expect(elements[i + 1]).toBe(old[i].element)
      expect(elements.map(geometryOf)).toEqual(elements.map((_, j) => targetOf(chart, j)))
      expect(animator.running(chart)).toBe(false)
    })

    it(`places new flows in one pass on ${name}`, () => {
      const chart = settled(options)
      const controller = meta(chart).controller
      const updateElements = controller.updateElements
      let calls = 0
      controller.updateElements = function (...args) {
        calls++
        return updateElements.apply(this, args)
      }

      chart.data.datasets[0].data = data.map((row) => ({ ...row, to: `${row.to}'` }))
      chart.update(mode)

      expect(calls).toBe(1)
    })
  }
})

describe('flows after the data was emptied', () => {
  it('reveals every flow of new data at its own place', () => {
    const chart = settled()
    chart.data.datasets[0].data = []
    chart.update('none')

    replace(chart, [ADDED, ...data])

    for (let j = 0; j <= data.length; j++) expectRevealed(chart, j, [])
    chart.stop()
  })
})

describe('flows across an update that does not replace the data', () => {
  it('keeps every flow when a row is added to the same array, and reveals the new one', () => {
    const chart = settled()
    const old = snapshot(chart)

    chart.data.datasets[0].data.unshift(ADDED)
    chart.update()

    // Chart.js inserts the element at its row; it would start at the old place of row 0.
    expectKept(chart, old, [-1, ...ALL])
    expectRevealed(chart, 0, old)
    chart.stop()
  })

  it('keeps every flow at its place when the data does not change', () => {
    const chart = settled()
    const old = snapshot(chart)

    chart.update()

    expectKept(chart, old, ALL)
    expect(meta(chart).data.map(geometryOf)).toEqual(old.map((o) => o.geometry))
    chart.stop()
  })
})

// Chart.js tells hovered items apart by index and replays the last mouse event
// at the end of an update. A flow has the colour and hover colour of its source.
const COLORS = {
  M1: ['rgb(200, 40, 40)', 'rgb(100, 20, 20)'],
  M2: ['rgb(40, 160, 40)', 'rgb(20, 80, 20)'],
  S0: ['rgb(40, 40, 200)', 'rgb(20, 20, 100)'],
  S1: ['rgb(200, 160, 40)', 'rgb(100, 80, 20)'],
  S2: ['rgb(160, 40, 200)', 'rgb(80, 20, 100)'],
  S3: ['rgb(40, 160, 200)', 'rgb(20, 80, 100)'],
  S4: ['rgb(120, 120, 120)', 'rgb(60, 60, 60)'],
}
const colorsOf = (row) => COLORS[row?.from] ?? ['rgb(0, 0, 0)', 'rgb(0, 0, 0)']
const colorOf = (ctx) => colorsOf(ctx.raw)[0]
const hoverOf = (ctx) => colorsOf(ctx.raw)[1]

function hoverable() {
  return settled({
    animation: false,
    dataset: {
      colorFrom: colorOf,
      colorTo: colorOf,
      hoverColorFrom: hoverOf,
      hoverColorTo: hoverOf,
    },
  })
}

/** Moves the mouse to the middle of the flow of row `j` and returns the hovered element. */
async function hover(chart, j) {
  await triggerMouseEvent(chart, 'mousemove', meta(chart).data[j].getCenterPoint())
  const items = chart.getActiveElements()
  expect(items.length).toBe(1)
  return items[0].element
}

/**
 * Every flow has the colours of its own row, the hover ones only when it is
 * one of the active items, and every active item has the index of its element.
 */
function expectHoverState(chart) {
  const rows = chart.data.datasets[0].data
  const items = chart.getActiveElements()
  const active = new Set(items.map((item) => item.element))
  for (const item of items) expect(meta(chart).data[item.index]).toBe(item.element)
  meta(chart).data.forEach((flow, j) => {
    const [own, hovered] = colorsOf(rows[j])
    expect(!!flow.active).toBe(active.has(flow))
    expect(flow.options.colorFrom).toBe(flow.active ? hovered : own)
  })
}

describe('a hovered flow across a data replacement', () => {
  it('keeps its own colours when a row is inserted in front', async () => {
    const chart = hoverable()
    const hovered = await hover(chart, 7)

    chart.data.datasets[0].data = [ADDED, ...data]
    chart.update()

    expectHoverState(chart)
    expect(meta(chart).data[8]).toBe(hovered)
  })

  it('leaves no flow with hover colours when the hovered row is removed', async () => {
    const chart = hoverable()
    const hovered = await hover(chart, 2)

    chart.data.datasets[0].data = data.filter((_, i) => i !== 2)
    chart.update()

    // (Booleans: printing an array of flows with their node graph does not end.)
    expectHoverState(chart)
    expect(meta(chart).data.includes(hovered)).toBe(false)
    expect(chart.getActiveElements().some((item) => item.element === hovered)).toBe(false)
  })

  it('leaves the active items of another dataset as they are', () => {
    const chart = settled({ animation: false })
    chart.data.datasets.push({ data: [...data] })
    chart.update()
    chart.setActiveElements([{ datasetIndex: 1, index: 3 }])
    const [item] = chart.getActiveElements()

    chart.data.datasets[0].data = data.slice(1)
    chart.update()

    const [after] = chart.getActiveElements()
    expect(after.datasetIndex).toBe(1)
    expect(after.index).toBe(3)
    expect(after.element === item.element).toBe(true)
  })
})

// Without a mouse event, nothing replays the items after an update: they must
// follow their flows themselves.
describe('a flow made active from code across a data replacement', () => {
  it('stays active at its new index when a row is inserted in front', () => {
    const chart = hoverable()
    chart.setActiveElements([{ datasetIndex: 0, index: 7 }])
    const active = meta(chart).data[7]

    chart.data.datasets[0].data = [ADDED, ...data]
    chart.update()

    const items = chart.getActiveElements()
    expect(items.length).toBe(1)
    expect(items[0].index).toBe(8)
    expect(items[0].element === active).toBe(true)
    expect(active.active).toBe(true)
    expectHoverState(chart)
  })

  it('is no longer active when its row is removed', () => {
    const chart = hoverable()
    chart.setActiveElements([{ datasetIndex: 0, index: 2 }])

    chart.data.datasets[0].data = data.filter((_, i) => i !== 2)
    chart.update()

    expect(chart.getActiveElements().length).toBe(0)
    expect(meta(chart).data.some((flow) => flow.active)).toBe(false)
    expectHoverState(chart)
  })

  it('keeps the tooltip on its flow when a row is inserted in front', () => {
    const chart = hoverable()
    const items = [{ datasetIndex: 0, index: 7 }]
    chart.setActiveElements(items)
    chart.tooltip.setActiveElements(items, meta(chart).data[7].getCenterPoint())

    chart.data.datasets[0].data = [ADDED, ...data]
    chart.update()
    chart.tooltip.update(true)

    const [item] = chart.tooltip.getActiveElements()
    expect(item.index).toBe(8)
    expect(item.element === meta(chart).data[8]).toBe(true)
    expect(chart.tooltip.body[0].lines).toEqual(['M2 -> T3: 14'])
  })
})
