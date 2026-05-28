const colors = {
  a: 'red',
  b: 'green',
  c: 'blue',
  d: 'gray',
  e: 'yellow',
  f: 'black',
  g: 'white',
  h: 'brown',
}

const getColor = (key) => colors[key]

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
          colorMode: 'gradient',
          colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
          data: [
            { flow: 10, from: 'a', to: 'b' },
            { flow: 5, from: 'a', to: 'c' },
            { flow: 10, from: 'a', to: 'd' },
            { flow: 5, from: 'd', to: 'e' },
            { flow: 5, from: 'd', to: 'f' },
            // { from: 'a', to: 'g', flow: 0.0001 },
            { flow: 0, from: 'a', to: 'h' },
            { flow: 0, from: 'h', to: 'i' },
          ],
          nodePadding: 50,
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
  tolerance: 0.02,
}
