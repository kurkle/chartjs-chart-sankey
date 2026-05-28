module.exports = {
  config: {
    data: {
      datasets: [
        {
          data: [
            { flow: 10, from: 'a', to: 'b' },
            { flow: 5, from: 'a', to: 'c' },
            { flow: 10, from: 'a', to: 'd' },
            { flow: 7, from: 'e', to: 'c' },
            { flow: 7, from: 'c', to: 'f' },
            { flow: 7, from: 'c', to: 'g' },
            { flow: 7, from: 'd', to: 'h' },
            { flow: 7, from: 'h', to: 'i' },
          ],
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
