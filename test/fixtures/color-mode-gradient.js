const colors = {
  a: 'blue',
  b: 'green',
  c: 'orange',
  d: 'red',
  e: 'violet',
}

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => colors[c.dataset.data[c.dataIndex].from],
          colorMode: 'gradient',
          colorTo: (c) => colors[c.dataset.data[c.dataIndex].to],
          data: [
            { flow: 20, from: 'a', to: 'b' },
            { flow: 10, from: 'b', to: 'c' },
            { flow: 10, from: 'a', to: 'c' },
            { flow: 10, from: 'b', to: 'd' },
            { flow: 20, from: 'c', to: 'e' },
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
