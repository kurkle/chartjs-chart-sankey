/**
 * d3-sankey-circular example "data3": global water cycle (Oceans, Evaporation, Atmosphere, ...); every node is in one strongly connected component. No flows dropped.
 *
 * Source: https://github.com/tomshanley/d3-sankey-circular/blob/master/example/example-data.js (data3)
 * License: MIT License
 * Copyright (c) 2017 Tom Shanley
 */
const data = [
  { flow: 4, from: 'Oceans', to: 'Evaporation' },
  { flow: 4, from: 'Evaporation', to: 'Condensation' },
  { flow: 4, from: 'Condensation', to: 'Atmosphere' },
  { flow: 4, from: 'Atmosphere', to: 'Precipitation' },
  { flow: 4, from: 'Precipitation', to: 'Ice and snow' },
  { flow: 4, from: 'Precipitation', to: 'Oceans' },
  { flow: 4, from: 'Precipitation', to: 'Surface runoff' },
  { flow: 4, from: 'Ice and snow', to: 'Infiltration' },
  { flow: 4, from: 'Ice and snow', to: 'Sublimation' },
  { flow: 4, from: 'Sublimation', to: 'Atmosphere' },
  { flow: 4, from: 'Infiltration', to: 'Groundwater flow' },
  { flow: 4, from: 'Infiltration', to: 'Groundwater storage' },
  { flow: 4, from: 'Groundwater storage', to: 'Oceans' },
  { flow: 4, from: 'Groundwater flow', to: 'Seepage' },
  { flow: 4, from: 'Groundwater flow', to: 'Spring' },
  { flow: 4, from: 'Groundwater flow', to: 'Plant uptake' },
  { flow: 4, from: 'Groundwater flow', to: 'Oceans' },
  { flow: 4, from: 'Groundwater flow', to: 'Freshwater' },
  { flow: 4, from: 'Seepage', to: 'Freshwater' },
  { flow: 4, from: 'Spring', to: 'Freshwater' },
  { flow: 4, from: 'Freshwater', to: 'Evaporation' },
  { flow: 4, from: 'Freshwater', to: 'Plants and animals' },
  { flow: 4, from: 'Freshwater', to: 'Seepage' },
  { flow: 4, from: 'Plant uptake', to: 'Plants and animals' },
  { flow: 4, from: 'Plants and animals', to: 'Freshwater' },
  { flow: 4, from: 'Surface runoff', to: 'Groundwater flow' },
  { flow: 4, from: 'Plants and animals', to: 'Evapotranspiration' },
  { flow: 4, from: 'Evapotranspiration', to: 'Atmosphere' },
  { flow: 4, from: 'Freshwater', to: 'Oceans' },
]

const palette = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac']

function hash(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return h
}

function getColor(name) {
  return palette[hash(name) % palette.length]
}

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
          colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
          data,
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 900,
      width: 1200,
    },
    spriteText: true,
  },
}
