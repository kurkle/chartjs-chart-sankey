import { animator } from 'chart.js'
import { acquireChart } from 'chartjs-test-utils'

// `backFlows` is part of the key of the cached plan, so changing it on a live
// chart has to lay the chart out again on the next update. Each case changes
// the option in place and compares with a chart that had the option from the
// start, so the layouts are the same whatever the way there was.
const data = [
  { flow: 40, from: 'Mine', to: 'Smelter' },
  { flow: 30, from: 'Smelter', to: 'Parts' },
  { flow: 10, from: 'Smelter', to: 'Slag' },
  { flow: 30, from: 'Parts', to: 'Machines' },
  { flow: 18, from: 'Machines', to: 'Scrap' },
  { flow: 12, from: 'Machines', to: 'Exported' },
  { flow: 12, from: 'Scrap', to: 'Smelter' },
  { flow: 6, from: 'Parts', to: 'Smelter' },
  { flow: 5, from: 'Scrap', to: 'Parts' },
  { flow: 60, from: 'Farm', to: 'Market' },
  { flow: 60, from: 'Market', to: 'Shop' },
  { flow: 60, from: 'Shop', to: 'Home' },
  { flow: 10, from: 'Home', to: 'Market' },
  { flow: 6, from: 'Shop', to: 'Market' },
]
const canvas = { height: 340, width: 620 }

const build = (backFlows, animation = false) =>
  acquireChart(
    {
      data: { datasets: [{ backFlows, data }] },
      options: { animation, devicePixelRatio: 1, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    },
    { canvas }
  )

const routes = (chart) =>
  JSON.parse(JSON.stringify(chart.getDatasetMeta(0).data.map((flow) => flow.route)))

// what the layout decided, before any animation
const targets = (chart) =>
  JSON.parse(JSON.stringify(chart.getDatasetMeta(0).controller._geometry.flows))

const finished = (chart) =>
  new Promise((resolve) => {
    const check = () => (animator.running(chart) ? setTimeout(check, 10) : resolve())
    check()
  })

const cases = {
  'bundle and auto': { bundle: 'target', side: 'auto' },
  'bundle source': { bundle: 'source' },
  'bundle target': { bundle: 'target' },
  'side auto': { side: 'auto' },
  'side start': { side: 'start' },
}

describe('backFlows changed on a live chart', () => {
  const plain = routes(build(undefined))

  it('has different layouts to compare', () => {
    for (const [name, options] of Object.entries(cases)) {
      expect(routes(build(options)), name).not.toEqual(plain)
    }
  })

  for (const [name, options] of Object.entries(cases)) {
    it(`matches a new chart after replacing the option (${name}, no animation)`, () => {
      const chart = build(undefined)
      chart.data.datasets[0].backFlows = { ...options }
      chart.update()
      expect(routes(chart)).toEqual(routes(build(options)))
      // and back to the defaults
      chart.data.datasets[0].backFlows = undefined
      chart.update()
      expect(routes(chart)).toEqual(plain)
    })

    it(`matches a new chart after replacing the option (${name}, animated)`, async () => {
      const chart = build(undefined, { duration: 60 })
      await finished(chart)
      chart.data.datasets[0].backFlows = { ...options }
      chart.update()
      // the layout is the final one at once, the bands travel to it
      expect(targets(chart)).toEqual(targets(build(options)))
      await finished(chart)
      expect(routes(chart)).toEqual(routes(build(options)))
      chart.data.datasets[0].backFlows = undefined
      chart.update()
      await finished(chart)
      expect(routes(chart)).toEqual(plain)
    })

    it(`matches a new chart after changing a field of the option in place (${name})`, () => {
      const chart = build({})
      Object.assign(chart.data.datasets[0].backFlows, options)
      chart.update()
      expect(routes(chart)).toEqual(routes(build(options)))
    })
  }

  it('changes the sides one by one', () => {
    const chart = build({})
    for (const side of ['start', 'auto', 'end', 'start']) {
      chart.data.datasets[0].backFlows.side = side
      chart.update()
      expect(routes(chart), side).toEqual(routes(build({ side })))
    }
  })

  it('resolves the option from the chart options too', () => {
    const chart = acquireChart(
      {
        data: { datasets: [{ data }] },
        options: { animation: false, backFlows: { side: 'start' }, maintainAspectRatio: false },
        type: 'sankey',
      },
      { canvas }
    )
    expect(routes(chart)).toEqual(routes(build({ side: 'start' })))
  })
})
