const { createCanvas } = require('@napi-rs/canvas')
const { Chart, LinearScale } = require('chart.js')

// side-effects: registers the controller and both elements
const { NodeElement } = require('chartjs-chart-sankey')

Chart.register(LinearScale)

if (Chart.registry.getElement('node') !== NodeElement) {
  throw new Error('the CommonJS entry did not register the node element')
}

const canvas = createCanvas(300, 320)
const ctx = canvas.getContext('2d')

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
