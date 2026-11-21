export default {
  config: {
    data: {
      datasets: [
        {
          // the lanes run before the content: the columns under the lane of
          // Use -> Factory start after it, Raw and Landfill beside it start at
          // the left edge
          backFlows: { side: 'start' },
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
          nodeAlign: 'start',
          orientation: 'vertical',
        },
      ],
    },
    type: 'sankey',
  },
  description:
    "nodeAlign: 'start' on a vertical chart packs every column at the left edge, after the lanes of the back flows where they run",
  options: {
    canvas: {
      height: 620,
      width: 340,
    },
    spriteText: true,
  },
}
