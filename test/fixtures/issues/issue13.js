module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { flow: 1, from: '1', to: 'Alpha' },
            { flow: 1, from: '2', to: 'Beta' },
            { flow: 1, from: '3', to: 'Gamma' },
            { flow: 1, from: '4', to: 'Delta' },
            { flow: 1, from: '5', to: 'Gamma' },
          ],
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 512,
      width: 512,
    },
    spriteText: true,
  },
}
