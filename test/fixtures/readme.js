const colors = {
  a: 'red',
  b: 'green',
  c: 'blue',
  d: 'gray',
}

const getColor = (key) => colors[key]

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
          colorMode: 'gradient', // or 'from' or 'to'
          colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
          /* optional column overrides */
          column: {
            d: 1,
          },
          data: [
            { flow: 10, from: 'a', to: 'b' },
            { flow: 5, from: 'a', to: 'c' },
            { flow: 10, from: 'b', to: 'c' },
            { flow: 7, from: 'd', to: 'c' },
          ],
          label: 'My sankey',
          /* optional labels */
          labels: {
            a: 'Label A',
            b: 'Label B',
            c: 'Label C',
            d: 'Label D',
          },
          /* optional priority */
          priority: {
            b: 1,
            d: 0,
          },
          size: 'max', // or 'min' if flow overlap is preferred
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    spriteText: true,
  },
}
