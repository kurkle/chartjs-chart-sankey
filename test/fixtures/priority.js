const data = [
  { flow: 15, from: 'Oil', to: 'Fossil Fuels' },
  { flow: 20, from: 'Natural Gas', to: 'Fossil Fuels' },
  { flow: 25, from: 'Coal', to: 'Fossil Fuels' },
  { flow: 25, from: 'Coal', to: 'Electricity' },
  { flow: 60, from: 'Fossil Fuels', to: 'Energy' },
  { flow: 25, from: 'Electricity', to: 'Energy' },
]

const colors = {
  Coal: 'gray',
  Electricity: 'blue',
  Energy: 'orange',
  'Fossil Fuels': 'slategray',
  Oil: 'black',
}

const priority = {
  Coal: 3,
  Electricity: 2,
  Energy: 1,
  'Fossil Fuels': 1,
  'Natural Gas': 2,
  Oil: 1,
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
          priority,
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
  threshold: 0.15,
}
