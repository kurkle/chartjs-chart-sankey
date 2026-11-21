---
title: Circular Flows
description: Flows that return to an earlier column are routed around the chart, so recycling loops and cycles stay readable.
---

Real systems often loop back: waste is recycled into production, a reactor sends part of its output back to the mixer, a node feeds itself. A flow whose target is not in a later column than its source is called a back flow. Sankey cannot draw it between the columns in the usual way, because the target is behind the source, so it leaves the source, runs along the bottom of the chart (the right side when vertical) and enters the target from behind. Nothing needs to be configured: this is how back flows are drawn by default.

Each back flow gets a lane after the content. Loops are nested so they do not cross, and loops that do not overlap share a lane. Nodes are placed by the flows that go forward, so the loops do not push their nodes out of line. The lanes and the turns are part of the same layout as the nodes: they take their share of the chart, and on a small chart everything, the lanes and the gaps included, shrinks together instead of the loops being dropped.

Which flows are back flows is decided from the data: the flows are taken from the largest to the smallest, and the one that would close a cycle is the back flow, so the biggest flows keep running forward whatever the order of the data. Use the `column` option to pin nodes to columns. Switch the orientation below to see how the same loops are routed when the columns run from top to bottom.

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Raw', to: 'Factory', flow: 60 },
  { from: 'Factory', to: 'Product', flow: 70 },
  { from: 'Factory', to: 'Waste', flow: 10 },
  { from: 'Product', to: 'Use', flow: 70 },
  { from: 'Use', to: 'Landfill', flow: 50 },
  { from: 'Use', to: 'Factory', flow: 20 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Recycling loop',
        orientation: 'horizontal',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [{ path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' }],
}
```

## Two nested loops

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Feed', to: 'Mix', flow: 50 },
  { from: 'Mix', to: 'Reactor', flow: 60 },
  { from: 'Reactor', to: 'Separator', flow: 70 },
  { from: 'Separator', to: 'Product', flow: 40 },
  { from: 'Separator', to: 'Reactor', flow: 20 },
  { from: 'Separator', to: 'Mix', flow: 10 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Two nested loops',
        orientation: 'horizontal',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [{ path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' }],
}
```

## A flow to the same node

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'A', to: 'B', flow: 20 },
  { from: 'B', to: 'B', flow: 10 },
  { from: 'B', to: 'C', flow: 20 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'A flow to the same node',
        orientation: 'horizontal',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [{ path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' }],
}
```

## A ring

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'a', to: 'b', flow: 10 },
  { from: 'b', to: 'c', flow: 10 },
  { from: 'c', to: 'a', flow: 10 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'A ring',
        orientation: 'horizontal',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [{ path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' }],
}
```

## Bundling the lanes and choosing a side

By default every back flow has a lane of its own after the content. `backFlows.bundle` puts the back flows to one node into a shared lane: the flows from the nearest column run innermost, and the turns at the target go round each other. `backFlows.side` moves the lanes to the start of the cross axis (`start`, the top of a horizontal chart) or lets each lane pick the side nearer to its flows (`auto`). Below, Smelter gets scrap and parts back from the later columns, and Market gets back what its shop and customers return: with `auto` the lanes of the smelter run along the top, where its loops are, and those of the market stay at the bottom.

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Mine', to: 'Smelter', flow: 40 },
  { from: 'Smelter', to: 'Parts', flow: 30 },
  { from: 'Smelter', to: 'Slag', flow: 10 },
  { from: 'Parts', to: 'Machines', flow: 30 },
  { from: 'Machines', to: 'Scrap', flow: 18 },
  { from: 'Machines', to: 'Exported', flow: 12 },
  { from: 'Scrap', to: 'Smelter', flow: 12 },
  { from: 'Parts', to: 'Smelter', flow: 6 },
  { from: 'Farm', to: 'Market', flow: 60 },
  { from: 'Market', to: 'Shop', flow: 60 },
  { from: 'Shop', to: 'Home', flow: 60 },
  { from: 'Home', to: 'Market', flow: 10 },
  { from: 'Shop', to: 'Market', flow: 6 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Lanes and sides',
        orientation: 'horizontal',
        backFlows: { bundle: false, side: 'end' },
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [
    { path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' },
    { path: 'data.datasets.0.backFlows.bundle', label: 'backFlows.bundle', values: [false, true], control: 'checkbox' },
    { path: 'data.datasets.0.backFlows.side', label: 'backFlows.side', values: ['end', 'start', 'auto'], control: 'radio' },
  ],
}
```
