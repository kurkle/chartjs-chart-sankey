---
title: Flow Labels
description: Display and style values on Sankey flows.
---

Flow labels display each link's numeric `flow` value. Their options are scriptable with the standard Sankey data context.

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Customer journey',
      data: [
        { from: 'Visits', to: 'Product views', flow: 80 },
        { from: 'Visits', to: 'Exit', flow: 20 },
        { from: 'Product views', to: 'Cart', flow: 32 },
        { from: 'Product views', to: 'Exit', flow: 48 },
        { from: 'Cart', to: 'Purchase', flow: 18 },
        { from: 'Cart', to: 'Abandoned', flow: 14 },
      ],
      colorFrom: (context) => Utils.getColor(context.raw.from),
      colorTo: (context) => Utils.getColor(context.raw.to),
      flowLabels: {
        display: (context) => context.raw.flow >= 15,
        position: 'center',
        color: (context) => (context.raw.to === 'Exit' ? '#842029' : '#17324d'),
        backgroundColor: (context) =>
          context.raw.to === 'Exit' ? 'rgba(248, 215, 218, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: 4,
        padding: 4,
        font: {
          size: 11,
          weight: 'bold',
        },
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
