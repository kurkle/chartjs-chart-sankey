module.exports = {
  config: {
    data: {
      datasets: [
        {
          column: {
            Coal: 2,
            Electricity: 3,
            Energy: 4,
            'Natural Gas': 1,
            Oil: 0,
          },
          data: [
            { flow: 15, from: 'Oil', to: 'Energy' },
            { flow: 20, from: 'Natural Gas', to: 'Energy' },
            { flow: 25, from: 'Coal', to: 'Energy' },
            { flow: 25, from: 'Electricity', to: 'Energy' },
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
