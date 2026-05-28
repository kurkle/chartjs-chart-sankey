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

const labels = {
  'Fossil Fuels': 'Fossil',
  'Natural Gas': 'Nat. gas',
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
