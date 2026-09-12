---
title: Node Min Size
description: Keep a node with a tiny flow visible next to one with a huge flow.
---

A column with one dominant source and several minor ones is common in traffic and funnel reports (see [issue 87](https://github.com/kurkle/chartjs-chart-sankey/issues/87)): a flow of a few hundred next to flows under one. Without a minimum, those small nodes' bars round down to a fraction of a pixel and effectively disappear.

```js chart-editor title="Without nodeMinSize"
// <block:data:1>
const flows = [
  { from: 'Homepage', to: 'Sessions', flow: 420 },
  { from: 'Referral', to: 'Sessions', flow: 0.9 },
  { from: 'Social', to: 'Sessions', flow: 0.6 },
  { from: 'Email', to: 'Sessions', flow: 0.4 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Node min size',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
    colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = { config }
```

`nodeMinSize` stretches the drawn bar of Referral, Social and Email to at least the requested size, centered on each node's real position — the underlying flows keep their exact proportions and connection points, so a flow of 0.9 is still a hairline inside its now-visible node:

```js chart-editor title="With nodeMinSize"
// <block:data:1>
const flows = [
  { from: 'Homepage', to: 'Sessions', flow: 420 },
  { from: 'Referral', to: 'Sessions', flow: 0.9 },
  { from: 'Social', to: 'Sessions', flow: 0.6 },
  { from: 'Email', to: 'Sessions', flow: 0.4 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Node min size',
        data: flows,
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
    colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
    colorMode: 'gradient',
    nodeMinSize: 8,
  },
}
// </block:config>

module.exports = { config }
```

The node is visible now; the flow itself is not. If a 0.9-unit flow needs to be visible too, the data has to be clamped to a minimum before charting — that's a data decision, not something `nodeMinSize` can do, since it only ever changes how a node's bar is drawn, not what any flow is worth. See [Node Min Size](/usage/#node-min-size) in Usage for the full semantics.
