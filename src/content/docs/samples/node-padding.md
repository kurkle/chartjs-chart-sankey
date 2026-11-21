---
title: Node Padding
description: Widen the gap around a single node without changing every other gap in the column.
---

`nodePadding` resolves per node, so a single wide gap can separate groups within a column while every other gap stays at the default (see [Usage](/usage/#node-padding) for how the requested pixel value relates to what actually renders). Adjacent gaps collapse like CSS margins — `max(prevNode.after, nextNode.before)` — rather than summing, so only one side needs to grow. The same grouping could come from a function instead of a keyed object, if which nodes belong together has to be worked out from the data rather than known up front.

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Coal', to: 'Generation', flow: 25 },
  { from: 'Gas', to: 'Generation', flow: 20 },
  { from: 'Wind', to: 'Generation', flow: 18 },
  { from: 'Solar', to: 'Generation', flow: 12 },
  { from: 'Generation', to: 'Homes', flow: 35 },
  { from: 'Generation', to: 'Industry', flow: 40 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Node padding',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
    colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
    colorMode: 'gradient',
    priority: {
      Coal: 1,
      Gas: 2,
      Wind: 3,
      Solar: 4,
    },
    nodePadding: {
      Gas: { after: 48 },
    },
  },
}
// </block:config>

module.exports = { config }
```

## Node Padding Mode

**Deprecated.** `nodePaddingMode` keeps working until 1.0, where it is removed without a replacement, and it has an effect only with `nodeAlign: 'auto'` (the default). [`nodeAlign`](/samples/node-align/) `'start'` and `'end'` give exactly the requested gaps. What follows, the measured gaps included, holds for `nodeAlign: 'auto'`.

By default (`nodePaddingMode: 'auto'`), each column is packed with the requested gaps and then every node is moved as close as it can get to where its flows meet the nodes at the other end, without changing the order and without bringing two nodes closer than the gap. A column whose nodes are all pulled the same way keeps the requested gaps, but where two neighbours are pulled apart the gap between them grows. Below, four sources feed two middle nodes: the source column keeps the gap you ask for, while the gap between Thermal and Renewables grows to about 1.6 times `nodePadding` (31.5 px for a requested 20 px, measured on the 598 px by 420 px chart below), and so does the first gap of the last column (24.4 px). `nodePaddingMode: 'even'` moves a column as one block instead, so every gap is exactly the requested one, but nodes are no longer aligned with their flows, so those flows bend more to reach their target. Drag `nodePadding` to see both modes respond to the same requested gap:

```js chart-editor
// <block:data:1>
const modeFlows = [
  { from: 'Coal', to: 'Thermal', flow: 14 },
  { from: 'Gas', to: 'Thermal', flow: 4 },
  { from: 'Wind', to: 'Renewables', flow: 10 },
  { from: 'Solar', to: 'Renewables', flow: 6 },
  { from: 'Thermal', to: 'Homes', flow: 14 },
  { from: 'Thermal', to: 'Industry', flow: 4 },
  { from: 'Renewables', to: 'Industry', flow: 6 },
  { from: 'Renewables', to: 'Exports', flow: 10 },
]
// </block:data>

// <block:config:0>
const base = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Node padding mode',
        data: modeFlows,
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

const even = {
  ...base,
  options: {
    ...base.options,
    nodePaddingMode: 'even',
  },
}
// </block:config>

module.exports = {
  charts: [
    { title: 'Auto (default)', config: base },
    { title: 'Even', config: even },
  ],
  choices: [{ path: 'options.nodePadding', min: 0, max: 40, step: 4, control: 'range' }],
}
```

`auto` and `even` only diverge when moving a node towards its flows opens a gap wider than the requested one. The first example on this page has a single node in its middle column, so there is no gap to widen there, and `auto` and `even` would draw that column the same way.
