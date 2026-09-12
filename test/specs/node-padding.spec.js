import { acquireChart } from '../utils'

// Same energy data as resize.spec.js: column 0 has five nodes (Oil, Natural
// gas, Coal, Nuclear, Renewables), so nodePadding gaps actually show up.
const data = [
  { flow: 15, from: 'Oil', to: 'Fossil fuels' },
  { flow: 20, from: 'Natural gas', to: 'Fossil fuels' },
  { flow: 25, from: 'Coal', to: 'Fossil fuels' },
  { flow: 60, from: 'Fossil fuels', to: 'Energy' },
  { flow: 10, from: 'Nuclear', to: 'Energy' },
  { flow: 30, from: 'Renewables', to: 'Energy' },
  { flow: 40, from: 'Energy', to: 'Electricity' },
  { flow: 35, from: 'Energy', to: 'Heat' },
  { flow: 25, from: 'Energy', to: 'Lost' },
]

function buildSankey(devicePixelRatio) {
  return acquireChart(
    {
      data: {
        datasets: [{ data, nodePadding: 10 }],
      },
      options: {
        animation: false,
        devicePixelRatio,
        maintainAspectRatio: false,
      },
      type: 'sankey',
    },
    {
      canvas: { height: 400, width: 800 },
    }
  )
}

describe('nodePadding', () => {
  it('lays out flows identically regardless of devicePixelRatio (#CSS-pixels)', () => {
    const chart1x = buildSankey(1)
    const chart2x = buildSankey(2)

    const flows1x = chart1x.getDatasetMeta(0).data
    const flows2x = chart2x.getDatasetMeta(0).data

    expect(flows1x.length).toBeGreaterThan(0)
    expect(flows1x.length).toBe(flows2x.length)

    flows1x.forEach((flow1x, i) => {
      const flow2x = flows2x[i]
      expect(flow2x.x, `flow ${i} x`).toBeCloseTo(flow1x.x, 2)
      expect(flow2x.y, `flow ${i} y`).toBeCloseTo(flow1x.y, 2)
      expect(flow2x.x2, `flow ${i} x2`).toBeCloseTo(flow1x.x2, 2)
      expect(flow2x.y2, `flow ${i} y2`).toBeCloseTo(flow1x.y2, 2)
      expect(flow2x.height, `flow ${i} height`).toBeCloseTo(flow1x.height, 2)
    })
  })
})
