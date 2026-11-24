import { createCanvas } from '@napi-rs/canvas'
import { Chart, LinearScale } from 'chart.js'
import { Flow, NodeElement, SankeyController } from 'chartjs-chart-sankey'

Chart.register(LinearScale, SankeyController, Flow, NodeElement)

const canvas = createCanvas(300, 320)
const ctx = canvas.getContext('2d')

export const chart = new Chart(ctx, {
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

const { nodes } = chart.getDatasetMeta(0)
if (nodes.length !== 3 || !nodes.every((node) => node instanceof NodeElement)) {
  throw new Error('the chart does not keep one node element per node')
}
