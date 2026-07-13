---
title: Energy
description: Energy flow Sankey sample.
---

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Energy flow',
      colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
      colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
      colorMode: 'gradient',
      data: [
        { from: 'Coal', to: 'Electricity', flow: 35 },
        { from: 'Gas', to: 'Electricity', flow: 25 },
        { from: 'Wind', to: 'Electricity', flow: 18 },
        { from: 'Solar', to: 'Electricity', flow: 12 },
        { from: 'Electricity', to: 'Residential', flow: 30 },
        { from: 'Electricity', to: 'Industry', flow: 40 },
        { from: 'Electricity', to: 'Transport', flow: 20 },
      ],
    },
  ],
}
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data,
}
// </block:config>

module.exports = { config }
```
