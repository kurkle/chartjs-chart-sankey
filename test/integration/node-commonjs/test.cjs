const { createCanvas } = require('@napi-rs/canvas')
const { Chart, LinearScale } = require('chart.js')

// side-effects
require('chartjs-chart-sankey')

Chart.register(LinearScale)

const canvas = createCanvas(300, 320)
const ctx = canvas.getContext('2d')

// Chart.js assumes ctx contains the canvas
ctx.canvas = canvas

module.exports = new Chart(ctx, {
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
