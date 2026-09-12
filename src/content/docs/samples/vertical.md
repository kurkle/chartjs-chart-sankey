---
title: Vertical
description: Lay out a Sankey chart from top to bottom.
---

Set `orientation` to `vertical` to transpose the chart. The default is `horizontal`, which flows from left to right.

```js chart-editor
// <block:data:1>
const flows = [
  { from: 'Visits', to: 'Product views', flow: 80 },
  { from: 'Visits', to: 'Exit', flow: 20 },
  { from: 'Product views', to: 'Cart', flow: 32 },
  { from: 'Product views', to: 'Exit', flow: 48 },
  { from: 'Cart', to: 'Purchase', flow: 18 },
  { from: 'Cart', to: 'Abandoned', flow: 14 },
]
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Customer journey',
        orientation: 'vertical',
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

module.exports = { config }
```
