module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { flow: 8, from: 'a', to: 'b' },
            { flow: 9, from: 'b', to: 'c' },
            { flow: 1, from: 'b', to: 'd' },
            { flow: 7, from: 'a', to: 'e' },
            { flow: 10, from: 'e', to: 'f' },
            { flow: 5, from: 'e', to: 'g' },
          ],
          size: 'max',
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
