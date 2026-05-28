const data = [
  { flow: 100, from: 'Oil', to: 'Fossil Fuels' },
  { flow: 50, from: 'Oil', to: 'Natural Gas' },
  { flow: 50, from: 'Natural Gas', to: 'Coal' },
  { flow: 50, from: 'Coal', to: 'Electricity' },
  { flow: 100, from: 'Fossil Fuels', to: 'Energy' },
]

const colors = {
  Coal: 'gray',
  Electricity: 'blue',
  Energy: 'orange',
  'Fossil Fuels': 'slategray',
  Oil: 'black',
}

const labels = {
  Coal: 'Coal\nsubtitle 1\nsubtitle 2\nsubtitle 3\nsubtitle 4',
  Electricity: 'Electricity\nsubtitle 1',
  Energy: 'Energy\nsubtitle 1\nsubtitle 2\nsubtitle 3',
  'Fossil Fuels': 'Fossil\nsubtitle 1\nsubtitle 2',
  'Natural Gas': 'Nat. gas \nsubtitle 1\nsubtitle 2',
}

function getColor(name) {
  return colors[name] || 'green'
}

module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
          colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
          data,
          labels,
          padding: -20,
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 512,
      width: 512,
    },
    spriteText: true,
  },
}
