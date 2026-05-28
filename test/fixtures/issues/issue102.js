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
            // { from: 'a', to: 'b', flow: 10 },
            { flow: 5, from: 'a', to: 'c' },
            // { from: 'a', to: 'd', flow: 10 },
            { flow: 5, from: 'd', to: 'e' },
            // { from: 'd', to: 'f', flow: 5 },
            // { from: 'a', to: 'g', flow: 0.0001 },
            { flow: 0, from: 'a', to: 'h' },
          ],

          labels: {
            a: 'A',
            b: 'B',
            c: 'C',
            d: 'D',
            e: 'DA',
            f: 'DB',
            g: 'NOTOVERLAPPING',
            h: 'BUG',
          },
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
}
