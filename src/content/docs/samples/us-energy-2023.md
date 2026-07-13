---
title: U.S. Energy Consumption
description: A complex real-world Sankey diagram of U.S. energy consumption in 2023.
chartTitle: U.S. Energy Consumption in 2023
chartHeight: 600
---

Energy flows are measured in quadrillion British thermal units (quads). Values are adapted from the [Lawrence Livermore National Laboratory 2023 U.S. energy flow chart](https://flowcharts.llnl.gov/sites/flowcharts/files/styles/orig/public/2026-01/sankey_diagram_for_energy_usage_in_2023_for_united_states.png), based on U.S. Department of Energy/Energy Information Administration data. Totals may differ slightly because the source values are independently rounded.

```js chart-editor
// <block:data:1>
const data = [
  { from: 'Solar', to: 'Electricity generation', flow: 0.56 },
  { from: 'Solar', to: 'Residential', flow: 0.23 },
  { from: 'Solar', to: 'Commercial', flow: 0.07 },
  { from: 'Solar', to: 'Industrial', flow: 0.02 },
  { from: 'Nuclear', to: 'Electricity generation', flow: 8.1 },
  { from: 'Hydro', to: 'Electricity generation', flow: 0.83 },
  { from: 'Wind', to: 'Electricity generation', flow: 1.44 },
  { from: 'Geothermal', to: 'Electricity generation', flow: 0.06 },
  { from: 'Geothermal', to: 'Residential', flow: 0.04 },
  { from: 'Geothermal', to: 'Commercial', flow: 0.02 },
  { from: 'Natural gas', to: 'Electricity generation', flow: 13.37 },
  { from: 'Natural gas', to: 'Residential', flow: 4.71 },
  { from: 'Natural gas', to: 'Commercial', flow: 3.48 },
  { from: 'Natural gas', to: 'Industrial', flow: 10.86 },
  { from: 'Natural gas', to: 'Transportation', flow: 1.35 },
  { from: 'Coal', to: 'Electricity generation', flow: 7.25 },
  { from: 'Coal', to: 'Commercial', flow: 0.01 },
  { from: 'Coal', to: 'Industrial', flow: 0.88 },
  { from: 'Biomass', to: 'Electricity generation', flow: 0.34 },
  { from: 'Biomass', to: 'Residential', flow: 0.39 },
  { from: 'Biomass', to: 'Commercial', flow: 0.18 },
  { from: 'Biomass', to: 'Industrial', flow: 2.23 },
  { from: 'Biomass', to: 'Transportation', flow: 1.78 },
  { from: 'Petroleum', to: 'Electricity generation', flow: 0.18 },
  { from: 'Petroleum', to: 'Residential', flow: 0.95 },
  { from: 'Petroleum', to: 'Commercial', flow: 0.87 },
  { from: 'Petroleum', to: 'Industrial', flow: 8.59 },
  { from: 'Petroleum', to: 'Transportation', flow: 24.88 },
  { from: 'Net electricity imports', to: 'Electricity generation', flow: 0.01 },
  { from: 'Electricity generation', to: 'Residential', flow: 4.95 },
  { from: 'Electricity generation', to: 'Commercial', flow: 4.8 },
  { from: 'Electricity generation', to: 'Industrial', flow: 3.44 },
  { from: 'Electricity generation', to: 'Transportation', flow: 0.02 },
  { from: 'Electricity generation', to: 'Rejected energy', flow: 18.91 },
  { from: 'Residential', to: 'Rejected energy', flow: 3.95 },
  { from: 'Residential', to: 'Energy services', flow: 7.33 },
  { from: 'Commercial', to: 'Rejected energy', flow: 3.3 },
  { from: 'Commercial', to: 'Energy services', flow: 6.13 },
  { from: 'Industrial', to: 'Rejected energy', flow: 13.27 },
  { from: 'Industrial', to: 'Energy services', flow: 12.75 },
  { from: 'Transportation', to: 'Rejected energy', flow: 22.14 },
  { from: 'Transportation', to: 'Energy services', flow: 5.89 },
]
// </block:data>

// <block:helpers:2>
const colors = {
  Solar: '#f2c500',
  Nuclear: '#d7191c',
  Hydro: '#2446d8',
  Wind: '#92278f',
  Geothermal: '#8c5a18',
  'Natural gas': '#45a4e6',
  Coal: '#333333',
  Biomass: '#55c85a',
  Petroleum: '#006400',
  'Net electricity imports': '#ef9f2d',
  'Electricity generation': '#ef9f2d',
  Residential: '#f2a8b8',
  Commercial: '#f2a8b8',
  Industrial: '#f2a8b8',
  Transportation: '#f2a8b8',
  'Rejected energy': '#b3b3b3',
  'Energy services': '#666666',
}

const linkColor = (context) => {
  const { from, to } = context.raw
  const colorKey = to === 'Rejected energy' || to === 'Energy services' ? to : from
  return `${colors[colorKey]}99`
}
const tooltipLabel = (context) =>
  `${context.raw.from} → ${context.raw.to}: ${context.raw.flow} quads`
// </block:helpers>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        data,
        colorFrom: (context) => colors[context.raw.from],
        colorTo: (context) => colors[context.raw.to],
        linkColor,
        nodeWidth: 14,
        nodePadding: 8,
        priority: {
          Solar: 1,
          Nuclear: 2,
          Hydro: 3,
          Wind: 4,
          Geothermal: 5,
          'Natural gas': 6,
          Coal: 7,
          Biomass: 8,
          Petroleum: 9,
          Residential: 1,
          Commercial: 2,
          Industrial: 3,
          Transportation: 4,
          'Rejected energy': 1,
          'Energy services': 2,
        },
        nodeLabels: {
          font: { size: 10 },
          padding: 3,
        },
      },
    ],
  },
  options: {
    plugins: {
      tooltip: {
        callbacks: {
          label: tooltipLabel,
        },
      },
    },
  },
}
// </block:config>

module.exports = { config }
```
