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
          backFlows: { side: 'start' },
          colorFrom: '#4e79a7',
          colorTo: '#f28e2b',
          data,
        },
      ],
    },
    type: 'sankey',
  },
  description: 'Back flow lanes run before the content',
  options: {
    canvas: { height: 340, width: 620 },
    spriteText: true,
  },
}
