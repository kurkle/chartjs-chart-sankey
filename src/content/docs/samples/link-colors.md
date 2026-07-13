---
title: Link Colors
description: Color Sankey links independently from their nodes.
---

Use `linkColor` when links should have their own color instead of inheriting the source or destination node color.

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Link colors',
      data: [
        { from: 'Direct', to: 'Converted', flow: 16 },
        { from: 'Referral', to: 'Converted', flow: 9 },
        { from: 'Direct', to: 'Dropped', flow: 5 },
        { from: 'Referral', to: 'Dropped', flow: 7 },
      ],
      colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
      colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
      linkColor: (context) =>
        context.dataset.data[context.dataIndex].to === 'Converted'
          ? 'rgba(46, 160, 67, 0.55)'
          : 'rgba(218, 54, 51, 0.55)',
      hoverLinkColor: (context) =>
        context.dataset.data[context.dataIndex].to === 'Converted'
          ? 'rgb(46, 160, 67)'
          : 'rgb(218, 54, 51)',
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
