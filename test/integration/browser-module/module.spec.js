import { animator, Chart, registerables } from 'chart.js'

import { Flow, NodeElement, SankeyController } from '../../../dist/chartjs-chart-sankey.esm.js'

describe('browser esm integration', () => {
  const getRegisteredController = () => Chart.registry.controllers.items.sankey
  const getRegisteredElement = () => Chart.registry.elements.items.flow
  const getRegisteredNode = () => Chart.registry.elements.items.node
  let canvas

  afterEach(() => {
    canvas?.remove()
    canvas = null
    Chart.unregister(...registerables)
    Chart.unregister(SankeyController, Flow, NodeElement)
  })

  it('requires explicit registration for the built esm bundle', () => {
    expect(getRegisteredController()).toBeUndefined()
    expect(getRegisteredElement()).toBeUndefined()
    expect(getRegisteredNode()).toBeUndefined()
  })

  it('exports the node element and registers it with the others', () => {
    expect(NodeElement.id).toBe('node')
    Chart.register(SankeyController, Flow, NodeElement)
    expect(getRegisteredNode()).toBe(NodeElement)
  })

  // As the docs said before the node element was public: only the controller
  // and the flow element. The nodes are still drawn and animated.
  it('draws and animates the nodes with only the controller and the flow element registered', () => {
    Chart.register(...registerables, SankeyController, Flow)
    expect(getRegisteredNode()).toBeUndefined()

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
              { flow: 5, from: 'd', to: 'c' },
            ],
          },
        ],
      },
      options: { animation: { duration: 1000 }, maintainAspectRatio: false, responsive: false },
      type: 'sankey',
    })
    chart.stop()
    chart.update('none')

    const meta = chart.getDatasetMeta(0)
    expect(meta.nodes.map((el) => el.node.key).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(meta.nodes.every((el) => el instanceof NodeElement)).toBe(true)

    chart.data.datasets[0].nodeAlign = 'end'
    chart.update()
    expect(animator.running(chart)).toBe(true)
    const moving = meta.nodes.filter((el) => el.$animations?.y?.active())
    expect(moving.length).toBeGreaterThan(0)

    chart.destroy()
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
            flowLabels: {
              color: (context) => (context.raw.flow === 10 ? 'red' : 'blue'),
              display: (context) => context.raw.flow === 10,
            },
            nodeLabels: {
              backgroundColor: { a: 'white' },
              position: { a: 'right', b: 'left', c: 'left' },
            },
          },
        ],
      },
      type: 'sankey',
    })

    expect(chart.config.type).toBe('sankey')
    expect(chart.data.datasets.length).toBe(1)
    expect(chart.data.datasets[0].data.length).toBe(2)
    expect(chart.data.datasets[0].nodeLabels.position.a).toBe('right')
    const meta = chart.getDatasetMeta(0)
    expect(meta.type).toBe('sankey')
    expect(meta.controller).toBeTruthy()
    expect(meta.data[0].options.flowLabels.color).toBe('red')
    expect(meta.data[0].options.flowLabels.display).toBe(true)
    expect(meta.data[1].options.flowLabels.display).toBe(false)

    chart.destroy()
  })
})
