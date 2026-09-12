---
title: Node Padding
description: Widen the gap around a single node without changing every other gap in the column.
---

`nodePadding` resolves per node, so a single wide gap can separate groups within a column while every other gap stays at the default (see [Usage](/usage/#node-padding) for how the requested pixel value relates to what actually renders). Adjacent gaps collapse like CSS margins — `max(prevNode.after, nextNode.before)` — rather than summing, so only one side needs to grow. The same grouping could come from a function instead of a keyed object, if which nodes belong together has to be worked out from the data rather than known up front.

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Node padding',
      data: [
        { from: 'Coal', to: 'Generation', flow: 25 },
        { from: 'Gas', to: 'Generation', flow: 20 },
        { from: 'Wind', to: 'Generation', flow: 18 },
        { from: 'Solar', to: 'Generation', flow: 12 },
        { from: 'Generation', to: 'Homes', flow: 35 },
        { from: 'Generation', to: 'Industry', flow: 40 },
      ],
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
