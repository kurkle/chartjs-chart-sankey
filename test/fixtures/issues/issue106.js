const colors = {
  '29  ': 'navy',
  '110 ': 'magenta',
  '115 ': 'brown',
  AA: 'red',
  BB: 'green',
  CC: 'blue',
  DD: 'gray',
  EE: 'yellow',
  XX: 'black',
  YY: 'white',
}

const getColor = (key) => colors[key]

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
          colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
          data: [
            {
              flow: 5,
              from: '115 ',
              to: 'AA',
            },
            {
              flow: 4,
              from: '115 ',
              to: 'BB',
            },
            {
              flow: 4,
              from: '115 ',
              to: 'CC',
            },
            {
              flow: 4,
              from: '29  ',
              to: 'DD',
            },
            {
              flow: 3,
              from: '110 ',
              to: 'EE',
            },
            {
              flow: 5,
              from: 'AA',
              to: 'XX',
            },
            {
              flow: 4,
              from: 'BB',
              to: 'XX',
            },
            {
              flow: 4,
              from: 'CC',
              to: 'YY',
            },
            {
              flow: 4,
              from: 'DD',
              to: 'XX',
            },
            {
              flow: 3,
              from: 'EE',
              to: 'XX',
            },
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
