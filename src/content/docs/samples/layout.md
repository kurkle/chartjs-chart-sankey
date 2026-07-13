---
title: Layout
description: Control Sankey node columns, ordering, spacing, and sizing.
---

Use `column` and `priority` to override automatic placement. `nodeWidth`, `nodePadding`, and `size` control node geometry.

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Layout controls',
      data: [
        { from: 'Coal', to: 'Generation', flow: 25 },
        { from: 'Wind', to: 'Generation', flow: 18 },
        { from: 'Solar', to: 'Generation', flow: 12 },
        { from: 'Generation', to: 'Homes', flow: 20 },
        { from: 'Generation', to: 'Industry', flow: 28 },
        { from: 'Generation', to: 'Storage', flow: 7 },
      ],
      colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
      colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
      colorMode: 'gradient',
      column: {
        Storage: 2,
      },
      priority: {
        Wind: 1,
        Solar: 2,
        Coal: 3,
        Homes: 1,
        Industry: 2,
        Storage: 3,
      },
      nodeWidth: 18,
      nodePadding: 20,
      size: 'max',
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
