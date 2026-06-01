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
})
