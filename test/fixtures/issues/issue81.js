module.exports = {
  config: {
    data: {
      datasets: [
        {
          column: {
            Air1: 1,
            Air2: 2,
            Oil: 0,
            Oil1: 1,
            Stuff1: 1,
            Stuff2: 2,
          },
          data: [
            { flow: 15, from: 'Oil', to: 'Air1' },
            { flow: 20, from: 'Oil', to: 'Stuff1' },
            { flow: 25, from: 'Oil1', to: 'Air2' },
            { flow: 25, from: 'Oil1', to: 'Stuff2' },
          ],
          priority: {
            Air: 3,
            Air2: 1,
            Oil: 1,
            Oil1: 2,
            Stuff1: 2,
            Stuff2: 1,
          },
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
