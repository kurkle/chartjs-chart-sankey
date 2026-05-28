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
  },
}
