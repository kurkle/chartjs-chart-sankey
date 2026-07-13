---
title: Refugee Hosting
description: The largest refugee origin-to-host country corridors at the end of 2025.
chartTitle: Largest Refugee-Hosting Corridors in 2025
chartHeight: 600
---

This chart shows the 20 largest origin-to-host country refugee populations reported at the end of 2025. It represents population stocks, not the number of people who moved during the year. Data comes from the [UNHCR end-year population dataset](https://data.humdata.org/dataset/unhcr-population-data-for-world), published through the Humanitarian Data Exchange.

```js chart-editor
// <block:data:1>
const data = [
  { from: 'Origin · Syria', to: 'Host · Türkiye', flow: 2347756 },
  { from: 'Origin · Sudan', to: 'Host · Chad', flow: 1330950 },
  { from: 'Origin · Myanmar', to: 'Host · Bangladesh', flow: 1178003 },
  { from: 'Origin · Ukraine', to: 'Host · Germany', flow: 1173192 },
  { from: 'Origin · Afghanistan', to: 'Host · Pakistan', flow: 1158538 },
  { from: 'Origin · South Sudan', to: 'Host · Uganda', flow: 1033579 },
  { from: 'Origin · Ukraine', to: 'Host · Poland', flow: 972287 },
  { from: 'Origin · Afghanistan', to: 'Host · Iran', flow: 758339 },
  { from: 'Origin · Syria', to: 'Host · Germany', flow: 668647 },
  { from: 'Origin · DR Congo', to: 'Host · Uganda', flow: 644537 },
  { from: 'Origin · South Sudan', to: 'Host · Sudan', flow: 634954 },
  { from: 'Origin · Sudan', to: 'Host · South Sudan', flow: 571066 },
  { from: 'Origin · Sudan', to: 'Host · Libya', flow: 551727 },
  { from: 'Origin · Syria', to: 'Host · Lebanon', flow: 532357 },
  { from: 'Origin · South Sudan', to: 'Host · Ethiopia', flow: 422871 },
  { from: 'Origin · Syria', to: 'Host · Jordan', flow: 420835 },
  { from: 'Origin · Ukraine', to: 'Host · Czechia', flow: 392955 },
  { from: 'Origin · Somalia', to: 'Host · Kenya', flow: 319471 },
  { from: 'Origin · Somalia', to: 'Host · Ethiopia', flow: 317879 },
  { from: 'Origin · Syria', to: 'Host · Iraq', flow: 308226 },
]
// </block:data>

// <block:helpers:2>
const originColors = {
  Syria: '#e15759',
  Sudan: '#f28e2b',
  Myanmar: '#76b7b2',
  Ukraine: '#4e79a7',
  Afghanistan: '#59a14f',
  'South Sudan': '#edc949',
  'DR Congo': '#af7aa1',
  Somalia: '#ff9da7',
}

const originName = (value) => value.replace('Origin · ', '')
const displayName = (value) => value.replace(/^(Origin|Host) · /, '')
const people = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const labels = Object.fromEntries(
  data.flatMap(({ from, to }) => [
    [from, displayName(from)],
    [to, displayName(to)],
  ])
)
const tooltipLabel = (context) => {
  const { from, to, flow } = context.raw
  return `${displayName(from)} → ${displayName(to)}: ${people.format(flow)} people`
}
// </block:helpers>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        data,
        colorFrom: (context) => originColors[originName(context.raw.from)],
        colorTo: '#bab0ab',
        linkColor: (context) => `${originColors[originName(context.raw.from)]}99`,
        labels,
        nodeWidth: 14,
        nodePadding: 12,
        nodeLabels: {
          font: { size: 11 },
          padding: 3,
        },
        priority: {
          'Origin · Syria': 1,
          'Origin · Sudan': 2,
          'Origin · Myanmar': 3,
          'Origin · Ukraine': 4,
          'Origin · Afghanistan': 5,
          'Origin · South Sudan': 6,
          'Origin · DR Congo': 7,
          'Origin · Somalia': 8,
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
