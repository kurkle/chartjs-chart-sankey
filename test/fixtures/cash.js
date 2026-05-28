module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'green',
          colorTo: 'gray',
          data: [
            { flow: 1150, from: 'division a', to: 'revenue' },
            { flow: 650, from: 'dibision b', to: 'revenue' },
            { flow: 800, from: 'revenue', to: 'cost of sales' },
            { flow: 1000, from: 'revenue', to: 'cross profit' },
            { flow: 650, from: 'cross profit', to: 'operating expenses' },
            { flow: 350, from: 'cross profit', to: 'operating profit' },
          ],
          modeX: 'even',
          nodePadding: 100,
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 256,
      width: 512,
    },
    spriteText: true,
  },
}
