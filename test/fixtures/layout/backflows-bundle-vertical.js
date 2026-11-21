const data = [
  { flow: 60, from: 'Raw', to: 'Factory' },
  { flow: 70, from: 'Factory', to: 'Product' },
  { flow: 10, from: 'Factory', to: 'Waste' },
  { flow: 70, from: 'Product', to: 'Use' },
  { flow: 50, from: 'Use', to: 'Landfill' },
  { flow: 20, from: 'Use', to: 'Factory' },
  { flow: 8, from: 'Product', to: 'Factory' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          backFlows: { bundle: true, side: 'start' },
          colorFrom: '#4e79a7',
          colorTo: '#f28e2b',
          data,
          orientation: 'vertical',
        },
      ],
    },
    type: 'sankey',
  },
  description: 'Bundled lanes before the content of a vertical chart',
  options: {
    canvas: { height: 420, width: 420 },
    spriteText: true,
  },
}
