import type { ChartConfiguration, SankeyDataPoint } from 'chart.js'

import { Chart } from 'chart.js'
import { Flow, SankeyController } from 'chartjs-chart-sankey'

Chart.register(SankeyController, Flow)

const colors2 = [
  '#fff5eb',
  '#fee6ce',
  '#fdd0a2',
  '#fdae6b',
  '#fd8d3c',
  '#f16913',
  '#d94801',
  '#a63603',
  '#7f2704',
]
const assigned: Record<string, string> = {}

function getColor(name: string): string {
  if (!assigned[name]) {
    assigned[name] = colors2[Object.keys(assigned).length % colors2.length]
  }
  return assigned[name]
}

const config: ChartConfiguration<'sankey', SankeyDataPoint[]> = {
  data: {
    datasets: [
      {
        colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
        colorMode: 'gradient', // or 'from' or 'to'
        colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
        data: [
          { flow: 10, from: 'a', to: 'b' },
          { flow: 5, from: 'a', to: 'c' },
          { flow: 10, from: 'b', to: 'c' },
        ],
        label: 'My sankey',
        /* optional labels */
        labels: {
          a: 'Label A',
          b: 'Label B',
          c: 'Label C',
        },
      },
    ],
  },
  type: 'sankey',
}

const _chart = new Chart('test', config)
