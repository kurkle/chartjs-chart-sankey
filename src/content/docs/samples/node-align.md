---
title: Node Align
description: Pack the nodes of every column at the start or the end of the cross axis, or pin the outermost ones to both edges.
---

`nodeAlign` decides where the nodes of a column sit across the chart: top to bottom here, left to right in a vertical chart. It does not change which column a node is in (see [Usage](/usage/#node-align)).

- `auto` (the default) moves every node towards where its flows meet, so the flows run as straight as they can and some gaps grow wider than `nodePadding`.
- `start` and `end` pack every column at that edge with exactly the requested gaps, except where a flow that skips columns is held level (below). The flows bend more, because the nodes are no longer moved to them.
- `edges` puts the first and the last place of every column at the two edges, a node or a flow that skips the column, and moves the ones between them as `auto` does.

Pick a value to see the same chart drawn with it. The flow from Wind to Exports skips the two middle columns, so it takes a place in each of them, and it runs level across them with every value. Holding it level can leave a column it passes off its edge or with one gap wider than requested, with every value.

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Coal', to: 'Thermal', flow: 14 },
  { from: 'Gas', to: 'Thermal', flow: 4 },
  { from: 'Wind', to: 'Renewables', flow: 10 },
  { from: 'Solar', to: 'Renewables', flow: 6 },
  { from: 'Thermal', to: 'Grid', flow: 18 },
  { from: 'Renewables', to: 'Grid', flow: 10 },
  { from: 'Renewables', to: 'Storage', flow: 6 },
  { from: 'Wind', to: 'Exports', flow: 3 },
  { from: 'Grid', to: 'Homes', flow: 12 },
  { from: 'Grid', to: 'Industry', flow: 16 },
  { from: 'Storage', to: 'Homes', flow: 6 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Node align',
        data: flows,
        nodeAlign: 'start',
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
    colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
    colorMode: 'gradient',
    nodePadding: 20,
  },
}
// </block:config>

module.exports = {
  config,
  choices: [
    { path: 'data.datasets.0.nodeAlign', label: 'nodeAlign', values: ['auto', 'start', 'end', 'edges'], control: 'radio' },
    { path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' },
  ],
}
```
