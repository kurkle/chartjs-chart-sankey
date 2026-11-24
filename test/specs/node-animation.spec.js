import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

// The nodes of a sankey are elements in `meta.nodes`, tweened with their flows
// when an update moves them. `_geometry.nodes` holds the rectangles an update
// aims at; the elements hold where the bars are drawn now.
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
const RECT = ['x', 'y', 'width', 'height']
const FLOW = ['x', 'y', 'x2', 'y2', 'height', 'width']

function build({ animation = { duration: 1000 }, dataset = {}, height = 400, width = 700 } = {}) {
  return acquireChart(
    {
      data: { datasets: [{ data: [...data], nodePadding: 20, ...dataset }] },
      options: { animation, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas: { height, width } }
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
const targets = (chart) => meta(chart).controller._geometry
const pick = (obj, keys) => Object.fromEntries(keys.map((key) => [key, obj[key]]))

/** Where the nodes are drawn now, by key. */
function current(chart) {
  return Object.fromEntries(meta(chart).nodes.map((el) => [el.node.key, pick(el, RECT)]))
}

/** Where the running tweens of the nodes end, by key. */
function final(chart) {
  return Object.fromEntries(meta(chart).nodes.map((el) => [el.node.key, el.getProps(RECT, true)]))
}

/** The rectangles of the last update, by key. */
function rects(chart) {
  return Object.fromEntries([...targets(chart).nodes].map(([key, rect]) => [key, pick(rect, RECT)]))
}

const flowsNow = (chart) => meta(chart).data.map((flow) => pick(flow, FLOW))
const flowTargets = (chart) => targets(chart).flows.map((flow) => pick(flow, FLOW))

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
async function frames(count) {
  for (let i = 0; i < count; i++) await frame()
}
async function untilIdle(chart) {
  for (let i = 0; i < 600 && animator.running(chart); i++) await frame()
  expect(animator.running(chart)).toBe(false)
}

function setAlign(chart, nodeAlign) {
  chart.data.datasets[0].nodeAlign = nodeAlign
}

describe('node elements', () => {
  it('has no element before the dataset has rows, and one per node after', () => {
    const chart = settled({ dataset: { data: [] } })
    expect(meta(chart).nodes).toEqual([])

    chart.data.datasets[0].data = [...data]
    chart.update()
    const plan = [...meta(chart).controller._plan.nodes.values()]
    expect(meta(chart).nodes.map((el) => el.node)).toEqual(plan)
    expect(current(chart)).toEqual(rects(chart))
    chart.stop()
  })
  it('keeps one element per node in meta.nodes, in plan order, at the geometry', () => {
    const chart = settled()
    const plan = [...meta(chart).controller._plan.nodes.values()]
    const nodes = meta(chart).nodes

    expect(nodes.map((el) => el.node)).toEqual(plan)
    expect(current(chart)).toEqual(rects(chart))
  })

  it('keeps the element of a node across updates and drops the one of a removed node', () => {
    const chart = settled()
    const before = new Map(meta(chart).nodes.map((el) => [el.node.key, el]))

    chart.data.datasets[0].data = data.filter((row) => row.to !== 'T3')
    chart.update()

    const after = meta(chart).nodes
    expect(after.map((el) => el.node.key)).not.toContain('T3')
    expect(after.length).toBe(before.size - 1)
    for (const el of after) expect(el).toBe(before.get(el.node.key))
    chart.stop()
  })
})

describe('nodes move with their flows', () => {
  it('tweens the nodes from their old rectangles to the new ones on a nodeAlign change', () => {
    const chart = settled()
    const old = current(chart)

    setAlign(chart, 'end')
    chart.update()

    expect(rects(chart)).not.toEqual(old)
    expect(current(chart)).toEqual(old)
    expect(final(chart)).toEqual(rects(chart))
    expect(animator.running(chart)).toBe(true)
    chart.stop()
  })

  it('draws the label at the current place of the node, on the side of its final place', () => {
    // D is a sink: with modeX 'edge' it is in the last column (right half, label
    // on the left), with 'even' in the second of four (left half, label on the right).
    const chain = [
      { flow: 5, from: 'A', to: 'B' },
      { flow: 5, from: 'B', to: 'C' },
      { flow: 5, from: 'C', to: 'E' },
      { flow: 5, from: 'A', to: 'D' },
    ]
    const chart = settled({ dataset: { data: chain } })
    const el = () => meta(chart).nodes.find((node) => node.node.key === 'D')
    const old = pick(el(), RECT)

    chart.data.datasets[0].modeX = 'even'
    chart.update()
    const { borderWidth } = meta(chart).controller.options
    const target = targets(chart).nodes.get('D')
    expect(target.x).toBeLessThan(old.x)
    expect(pick(el(), RECT)).toEqual(old)

    const ctx = chart.ctx
    const calls = []
    const fillText = ctx.fillText
    ctx.fillText = function (text, x, y, ...rest) {
      calls.push({ align: this.textAlign, text, x, y })
      return fillText.call(this, text, x, y, ...rest)
    }
    try {
      chart.draw()
    } finally {
      ctx.fillText = fillText
    }

    const label = calls.find((call) => call.text === 'D')
    // 'right' of the node: left aligned, past its right edge (padding 4).
    expect(label.align).toBe('left')
    expect(label.x).toBe(old.x + old.width + borderWidth + 4)
    expect(label.y).toBe(old.y + old.height / 2)
    chart.stop()
  })
})

describe('nodes that are placed at once', () => {
  it('places the nodes at once on the first render', () => {
    const chart = build()
    expect(current(chart)).toEqual(rects(chart))
    expect(final(chart)).toEqual(rects(chart))
    chart.stop()
  })

  it('places a new node at once', () => {
    const chart = settled()
    chart.data.datasets[0].data = [...data, { flow: 3, from: 'M1', to: 'T4' }]
    chart.update()
    const added = meta(chart).nodes.find((el) => el.node.key === 'T4')
    expect(pick(added, RECT)).toEqual(rects(chart).T4)
    chart.stop()
  })

  const cases = {
    'a resize': [{}, (chart) => chart.resize(500, 300)],
    'animations off': [
      { animation: false },
      (chart) => {
        setAlign(chart, 'end')
        chart.update()
      },
    ],
  }
  for (const [name, [options, change]] of Object.entries(cases)) {
    it(`places the nodes at once on ${name}`, () => {
      const chart = settled(options)
      const old = current(chart)
      change(chart)
      expect(rects(chart)).not.toEqual(old)
      expect(current(chart)).toEqual(rects(chart))
      chart.stop()
    })
  }
})

describe('an update during a tween', () => {
  it('goes on to the rectangles of a second nodeAlign change', async () => {
    const chart = settled({ animation: { duration: 200 } })
    setAlign(chart, 'end')
    chart.update()
    await frames(3)
    setAlign(chart, 'start')
    chart.update()

    expect(final(chart)).toEqual(rects(chart))
    await untilIdle(chart)
    expect(current(chart)).toEqual(rects(chart))
    expect(flowsNow(chart)).toEqual(flowTargets(chart))
  })

  // Chart.js applies a resize during a tween at the next frame, and retargets
  // the running tween instead of snapping it.
  it('goes on to the rectangles of a resize, nodes and flows together', async () => {
    const chart = settled({ animation: { duration: 300 } })
    setAlign(chart, 'end')
    chart.update()
    await frames(3)
    chart.resize(500, 300)
    await frames(2)
    expect(chart.width).toBe(500)

    // Still moving, and the first flow (S1 -> M1) still touches both its nodes:
    // within a pixel, as the tweens of a node and of a flow are started in
    // separate calls, which can fall a millisecond apart.
    const [flow] = meta(chart).data
    const now = current(chart)
    expect(now).not.toEqual(rects(chart))
    expect(Math.abs(flow.y - now.S1.y)).toBeLessThan(1)
    expect(Math.abs(flow.y2 - now.M1.y)).toBeLessThan(1)

    await untilIdle(chart)
    expect(current(chart)).toEqual(rects(chart))
    expect(flowsNow(chart)).toEqual(flowTargets(chart))
  })

  const cases = {
    'an orientation change': (chart) => {
      chart.data.datasets[0].orientation = 'vertical'
      chart.update()
    },
    "an update with 'none'": (chart) => {
      setAlign(chart, 'start')
      chart.update('none')
    },
    'animations turned off': (chart) => {
      chart.options.animation = false
      setAlign(chart, 'start')
      chart.update()
    },
  }
  for (const [name, change] of Object.entries(cases)) {
    for (const [what, now, target] of [
      ['nodes', current, rects],
      ['flows', flowsNow, flowTargets],
    ]) {
      it(`ends the ${what} at ${name}`, async () => {
        const chart = settled()
        setAlign(chart, 'end')
        chart.update()
        await frames(3)
        change(chart)
        expect(now(chart)).toEqual(target(chart))
        // The tween that ran before must not write its old target over them.
        await frames(3)
        expect(now(chart)).toEqual(target(chart))
        chart.stop()
      })
    }
  }
})

// A context inherits from the dataset context, so it is read through its prototype.
const seen = (ctx) => pick(ctx, ['type', 'node', 'mode', 'datasetIndex', 'dataIndex', 'raw'])

describe('scriptable animation options', () => {
  it('are called once per node with a node context, and with the data index for a flow', () => {
    const calls = []
    // Written for flows: reads the data index.
    const delay = (ctx) => {
      calls.push(seen(ctx))
      return ctx.type === 'data' ? ctx.dataIndex * 10 : 0
    }
    const chart = settled({ dataset: { animations: { numbers: { delay } } } })
    calls.length = 0

    setAlign(chart, 'end')
    chart.update()

    const nodeCalls = calls.filter((ctx) => ctx.type === 'node')
    const nodes = meta(chart).nodes.map((el) => el.node)
    expect(nodeCalls.length).toBe(nodes.length)
    expect(new Set(nodeCalls.map((ctx) => ctx.node))).toEqual(new Set(nodes))
    for (const ctx of nodeCalls) {
      expect(ctx).toMatchObject({ dataIndex: undefined, datasetIndex: 0, mode: 'default' })
      expect(ctx.raw).toBeUndefined()
    }
    const flowCalls = calls.filter((ctx) => ctx.type === 'data').map((ctx) => ctx.dataIndex)
    expect(flowCalls.sort((a, b) => a - b)).toEqual(data.map((_, i) => i))

    // The mode is that of the update. (Chart.js puts a resize off while a tween runs.)
    chart.stop()
    calls.length = 0
    chart.resize(500, 300)
    const modes = calls.filter((ctx) => ctx.type === 'node').map((ctx) => ctx.mode)
    expect(modes).toEqual(nodes.map(() => 'resize'))
    chart.stop()
  })

  it('stagger the nodes by a delay from their column', async () => {
    // Column 1 starts at once, column 2 five seconds later.
    const delay = (ctx) => (ctx.type === 'node' ? (ctx.node.x - 1) * 5000 : 0)
    const chart = settled({ dataset: { animations: { numbers: { delay } } } })
    const old = current(chart)

    setAlign(chart, 'end')
    chart.update()
    await frames(3)

    // M1 (column 1) and T1 (column 2) both move; only M1 has started.
    const now = current(chart)
    expect(rects(chart).M1).not.toEqual(old.M1)
    expect(rects(chart).T1).not.toEqual(old.T1)
    expect(now.M1).not.toEqual(old.M1)
    expect(now.T1).toEqual(old.T1)
    chart.stop()
  })
})
