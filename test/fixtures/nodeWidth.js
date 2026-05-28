module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { flow: 20, from: 'a', to: 'b' },
            { flow: 10, from: 'c', to: 'd' },
            { flow: 5, from: 'c', to: 'e' },
          ],
          nodeWidth: 50,
        },
      ],
    },
    options: {
      layout: {
        padding: {
          right: 53,
        },
      },
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
