module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { destination: 'b', source: 'a', value: 20 },
            { destination: 'd', source: 'c', value: 10 },
            { destination: 'e', source: 'c', value: 5 },
          ],
        },
      ],
    },
    options: {
      parsing: {
        flow: 'value',
        from: 'source',
        to: 'destination',
      },
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 256,
      width: 512,
    },
  },
  threshold: 0.15,
}
