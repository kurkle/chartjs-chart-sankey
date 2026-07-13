import type { ChartConfiguration, ChartDataset, ChartTypeRegistry } from 'chart.js'
import type {
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyControllerDatasetOptions,
  SankeyDataPoint,
  SankeyLabelPosition,
  SankeyNodeLabelPosition,
  SankeyParsedData,
  SankeyParsingOptions,
  SankeyScriptableContext,
} from 'chartjs-chart-sankey'

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
        colorTo: ['#f00', '#0f0', '#00f'],
        data: [
          { flow: 10, from: 'a', to: 'b' },
          { flow: 5, from: 'a', to: 'c' },
          { flow: 10, from: 'b', to: 'c' },
        ],
        flowLabels: {
          backgroundColor: (context) => (context.raw.flow > 5 ? 'white' : 'transparent'),
          color: 'black',
          display: (context) => context.raw.flow > 0,
          font: { size: 10 },
          padding: 3,
          position: 'center',
        },
        label: 'My sankey',
        /* optional labels */
        labels: {
          a: 'Label A',
          b: 'Label B',
          c: 'Label C',
        },
        linkColor: (context) => (context.raw.flow > 5 ? '#999' : '#ccc'),
        nodeLabels: {
          backgroundColor: { a: '#333', b: '#666' },
          borderRadius: 3,
          color: (node) => (node.key === 'a' ? 'white' : 'black'),
          display: (node) => node.size > 0,
          font: { size: 11, weight: 'normal' },
          padding: 4,
          position: (node) => (node.key === 'a' ? 'right' : 'left'),
        },
      },
    ],
  },
  type: 'sankey',
}

const _chart = new Chart('test', config)

type MixedDataset = ChartDataset<keyof ChartTypeRegistry>

function getDatasetBackgroundColor(dataset: MixedDataset) {
  return dataset.backgroundColor
}

const _backgroundColor = getDatasetBackgroundColor(config.data.datasets[0])

type _PublicTypes = [
  SankeyControllerDatasetOptions,
  SankeyControllerDatasetFlowLabelsOptions,
  SankeyLabelPosition,
  SankeyNodeLabelPosition,
  SankeyParsingOptions,
  SankeyParsedData,
  SankeyScriptableContext,
]
