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

By default (`nodePaddingMode: 'auto'`), a node also has to clear every node stacked above it in the columns feeding into it, so it stays aligned with the flows arriving from the left. That requirement doesn't show up above, where the middle column has only one node — nothing to misalign it with. It shows up once a column narrows: below, four sources feed two middle nodes, and Renewables ends up with a gap several times the requested padding, because it has to clear all four sources' worth of space, not just the one real neighbor (Thermal) stacked above it in its own column. `nodePaddingMode: 'even'` gives every gap in a column the same size instead, but nodes are no longer aligned with the flows feeding them, so those flows bend more to reach their target. Drag `nodePadding` to see both modes respond to the same requested gap:

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

`auto` and `even` only diverge like this when some column has a node that must clear more than one node stacked in an earlier column. The first example on this page never hits that case — its middle column has just one node, with nothing above it to clear — so `auto` and `even` would render it identically.
