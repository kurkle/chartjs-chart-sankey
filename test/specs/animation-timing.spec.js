// The `progress` animation staggers flows by column. Which axis holds the
// column depends on `orientation`, which can be set on the dataset or on the
// chart. The scriptable delay/duration must resolve to the same values for
// both placements, so the timings are resolved through Chart.js itself.
const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 5, from: 'A', to: 'D' },
  { flow: 7, from: 'B', to: 'C' },
  { flow: 3, from: 'C', to: 'E' },
  { flow: 9, from: 'D', to: 'E' },
  { flow: 4, from: 'B', to: 'D' },
]

function timings(datasetOptions, chartOptions) {
  const chart = acquireChart(
    {
      data: { datasets: [{ data, ...datasetOptions }] },
      options: { animation: { duration: 1000 }, maintainAspectRatio: false, ...chartOptions },
      type: 'sankey',
    },
    { canvas: { height: 400, width: 600 } }
  )
  const controller = chart.getDatasetMeta(0).controller
  const { config } = chart
  const scopeKeys = config.datasetAnimationScopeKeys('sankey', 'default')
  const scopes = config.getOptionScopes(chart.data.datasets[0], scopeKeys)
  return data.map((_, i) => {
    const { progress } = config.createResolver(
      scopes,
      controller.getContext(i, false, 'default')
    ).animations
    return { delay: progress.delay, duration: progress.duration }
  })
}

describe('flow animation timing', () => {
  it('staggers horizontal flows by column', () => {
    const t = timings({}, {})
    for (const { delay, duration } of t) {
      expect(Number.isFinite(delay)).toBe(true)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(duration).toBeGreaterThan(0)
    }
    expect(t[0].delay).toBe(0)
    expect(t[3].delay).toBe(1 * 500 + 3 * 20)
    expect(t[0].duration).toBe(1 * 200)
  })

  it('times vertical flows alike whether orientation is on the dataset or the chart', () => {
    const onDataset = timings({ orientation: 'vertical' }, {})
    const onChart = timings({}, { orientation: 'vertical' })
    expect(onChart).toEqual(onDataset)
    for (const { delay, duration } of onChart) {
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThan(5000)
      expect(duration).toBeGreaterThan(0)
    }
  })

  it('does not change horizontal timing with an explicit horizontal orientation', () => {
    expect(timings({}, { orientation: 'horizontal' })).toEqual(timings({}, {}))
  })
})
