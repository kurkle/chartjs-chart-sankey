import { Chart, registerables } from 'chart.js'

import { Flow, SankeyController } from '../../../dist/chartjs-chart-sankey.esm.js'

describe('browser esm integration', () => {
  const getRegisteredController = () => Chart.registry.controllers.items.sankey
  const getRegisteredElement = () => Chart.registry.elements.items.flow
  let canvas

  afterEach(() => {
    canvas?.remove()
    canvas = null
    Chart.unregister(...registerables)
    Chart.unregister(SankeyController, Flow)
  })

  it('requires explicit registration for the built esm bundle', () => {
    expect(getRegisteredController()).toBeUndefined()
    expect(getRegisteredElement()).toBeUndefined()
  })

  it('imports the built esm bundle and creates a sankey chart after registration', () => {
    Chart.register(...registerables, SankeyController, Flow)

    expect(getRegisteredController()).toBe(SankeyController)
    expect(getRegisteredElement()).toBe(Flow)

    canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 150
    document.body.appendChild(canvas)

    const chart = new Chart(canvas.getContext('2d'), {
      data: {
        datasets: [
          {
            data: [
              { flow: 10, from: 'a', to: 'b' },
              { flow: 5, from: 'a', to: 'c' },
            ],
          },
        ],
      },
      type: 'sankey',
    })

    expect(chart.config.type).toBe('sankey')
    expect(chart.data.datasets.length).toBe(1)
    expect(chart.data.datasets[0].data.length).toBe(2)
    expect(chart.getDatasetMeta(0).type).toBe('sankey')
    expect(chart.getDatasetMeta(0).controller).toBeTruthy()

    chart.destroy()
  })
})
