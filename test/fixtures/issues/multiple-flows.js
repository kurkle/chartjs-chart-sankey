module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'blue',
          colorTo: 'red',
          data: [
            { flow: 516, from: 'A', to: 'B' },
            { flow: 220, from: 'A', to: 'C' },
            { flow: 64, from: 'A', to: 'D' },
            { flow: 50, from: 'A', to: 'B' },
          ],
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 256,
      width: 256,
    },
    spriteText: true,
  },
}
