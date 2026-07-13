import { Chart } from 'chart.js'

describe('fixtures', jasmine.fixtures(''))

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
    const fillRect = spyOn(chart.ctx, 'fillRect').and.callThrough()

    chart.draw()

    const rightEdges = fillRect.calls.allArgs().map(([x, _y, width]) => x + width)
    expect(Math.max(...rightEdges)).toBeCloseTo(chart.width - 3, 5)
  })
})
