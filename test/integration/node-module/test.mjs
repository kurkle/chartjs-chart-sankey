import { createCanvas } from '@napi-rs/canvas'
import { Chart, LinearScale } from 'chart.js'
import { Flow, SankeyController } from 'chartjs-chart-sankey'

Chart.register(LinearScale, SankeyController, Flow)

const canvas = createCanvas(300, 320)
const ctx = canvas.getContext('2d')

// Chart.js assumes ctx contains the canvas
ctx.canvas = canvas

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
