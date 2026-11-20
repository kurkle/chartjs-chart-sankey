export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: '#4e79a7',
          colorTo: '#f28e2b',
          data: [
            { flow: 60, from: 'Raw', to: 'Factory' },
            { flow: 70, from: 'Factory', to: 'Product' },
            { flow: 10, from: 'Factory', to: 'Waste' },
            { flow: 70, from: 'Product', to: 'Use' },
            { flow: 50, from: 'Use', to: 'Landfill' },
            { flow: 20, from: 'Use', to: 'Factory' },
          ],
          orientation: 'horizontal',
        },
      ],
    },
    type: 'sankey',
  },
  description: 'The recycling loop on a small horizontal chart, 190 by 344 pixels',
  options: {
    canvas: { height: 344, width: 190 },
    spriteText: true,
  },
}
