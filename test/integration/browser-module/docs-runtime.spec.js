import { Chart } from 'chart.js'

import { Flow, NodeElement, SankeyController } from '../../../dist/chartjs-chart-sankey.esm.js'
import { globals } from '../../../docs/chart-runtime.js'

// The runtime the docs pages run their samples with. Nothing else loads it
// outside a browser, so a name it registers but does not import would only
// show as an error on the docs site.
describe('docs runtime', () => {
  it('registers the controller and both elements for the samples', () => {
    expect(globals.Chart).toBe(Chart)
    expect(Chart.registry.getController('sankey')).toBe(SankeyController)
    expect(Chart.registry.getElement('flow')).toBe(Flow)
    expect(Chart.registry.getElement('node')).toBe(NodeElement)
  })
})
