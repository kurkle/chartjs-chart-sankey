---
title: Tree
description: A tree as a Sankey diagram, branching from one root and, reversed, merging into one.
chartHeight: 480
---

A tree is a Sankey diagram where every node has a single parent. The first chart has one root that branches out into two groups of leaves. The second chart reverses every flow, so the same leaves merge back into a single root. `priority` pins the root to the first position in its column.

`size` decides how tall a node is when the flows through it do not add up. Here the groups send out more than they receive, so `min` sizes a node by its smaller side and `max` by its larger side.

```js chart-editor
// <block:data:1>
const branches = [
  { from: 'Root', to: 'Left', flow: 11 },
  { from: 'Left', to: 'Left 1', flow: 6 },
  { from: 'Left', to: 'Left 2', flow: 2 },
  { from: 'Left', to: 'Left 3', flow: 2 },
  { from: 'Left', to: 'Left 4', flow: 4 },
  { from: 'Left', to: 'Left 5', flow: 4 },
  { from: 'Left', to: 'Left 6', flow: 3 },
  { from: 'Root', to: 'Right', flow: 12 },
  { from: 'Right', to: 'Right 1', flow: 2 },
  { from: 'Right', to: 'Right 2', flow: 7 },
  { from: 'Right', to: 'Right 3', flow: 4 },
  { from: 'Right', to: 'Right 4', flow: 5 },
  { from: 'Right', to: 'Right 5', flow: 4 },
  { from: 'Right', to: 'Right 6', flow: 6 },
  { from: 'Right', to: 'Right 7', flow: 6 },
  { from: 'Right', to: 'Right 8', flow: 6 },
  { from: 'Right', to: 'Right 9', flow: 6 },
]
const merges = branches.map((item) => ({ from: item.to, to: item.from, flow: item.flow }))
// </block:data>

// <block:config:0>
const options = {
  colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
  colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
  colorMode: 'gradient',
}

const branching = {
  type: 'sankey',
  data: {
    datasets: [{ label: 'Branching', data: branches, priority: { Root: 0 }, size: 'min' }],
  },
  options,
}

const merging = {
  type: 'sankey',
  data: {
    datasets: [{ label: 'Merging', data: merges, priority: { Root: 0 }, size: 'min' }],
  },
  options,
}
// </block:config>

module.exports = {
  charts: [
    { title: 'One root branching out', config: branching },
    { title: 'Leaves merging into one root', config: merging },
  ],
  choices: [{ path: 'data.datasets.0.size', values: ['min', 'max'], control: 'radio' }],
}
```
