import { Chart } from 'chart.js'

describe('fixtures', jasmine.fixtures(''))

describe('index', () => {
  it('should register controller and element', () => {
    expect(Chart.registry.getController('sankey')).toBeDefined()
    expect(Chart.registry.getElement('flow')).toBeDefined()
  })
})
