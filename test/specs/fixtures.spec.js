import { Chart } from 'chart.js'
import { createFixtures } from 'chartjs-test-utils'

// import.meta.glob resolves against this file, so the maps are built here and
// handed to the package.
const specsFromFixtures = createFixtures({
  configs: {
    ...import.meta.glob('../fixtures/**/*.js', { eager: true, import: 'default' }),
    ...import.meta.glob('../fixtures/**/*.json', { eager: true, import: 'default' }),
  },
  images: import.meta.glob('../fixtures/**/*.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
  prefix: '../fixtures/',
})

describe('fixtures', specsFromFixtures())

describe('index', () => {
  it('should register controller and element', () => {
    expect(Chart.registry.getController('sankey')).toBeDefined()
    expect(Chart.registry.getElement('flow')).toBeDefined()
  })

  it('should create a sankey chart without data', () => {
    const chart = window.acquireChart({
      data: {},
      options: {
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'OD pairs on hexagon level',
          },
        },
      },
      type: 'sankey',
    })

    expect(chart.config.type).toBe('sankey')
    expect(chart.data.datasets).toEqual([])
  })

  it('should lay out a vertical sankey from top to bottom', () => {
    const chart = window.acquireChart({
      data: {
        datasets: [
          {
            data: [
              { flow: 10, from: 'A', to: 'B' },
              { flow: 4, from: 'A', to: 'C' },
            ],
            orientation: 'vertical',
          },
        ],
      },
      options: {
        animation: false,
      },
      type: 'sankey',
    })

    const flow = chart.getDatasetMeta(0).data[0]
    expect(flow.options.orientation).toBe('vertical')
    expect(flow.y).toBeLessThan(flow.y2)
    expect(flow.width).toBeGreaterThan(0)
    expect(flow.height).toBe(0)
  })

  it('should reserve space for custom node widths', () => {
    const chart = window.acquireChart({
      data: {
        datasets: [
          {
            data: [
              { flow: 10, from: 'A', to: 'B' },
              { flow: 4, from: 'A', to: 'C' },
            ],
            nodeWidth: 18,
          },
        ],
      },
      options: {
        animation: false,
      },
      type: 'sankey',
    })
    // Vitest's spyOn calls through by default, unlike Jasmine's.
    const fillRect = vi.spyOn(chart.ctx, 'fillRect')

    chart.draw()

    const rightEdges = fillRect.mock.calls.map(([x, _y, width]) => x + width)
    // The outline is drawn half outside the node, so the fill stops a
    // whole pixel short of the chart area to keep the bars on the pixel grid.
    const { borderWidth } = chart.getDatasetMeta(0).controller.options
    expect(Math.max(...rightEdges)).toBeCloseTo(
      chart.chartArea.right - Math.ceil(borderWidth / 2),
      5
    )
  })
})
