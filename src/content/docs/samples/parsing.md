---
title: Parsing
description: Sankey sample with custom parsing keys.
---

```js chart-editor
// <block:data:1>
const data = {
  datasets: [
    {
      label: 'Parsing',
      colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].source),
      colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].target),
      colorMode: 'to',
      parsing: {
        from: 'source',
        to: 'target',
        flow: 'value',
      },
      data: [
        { source: 'North', target: 'Hub', value: 12 },
        { source: 'South', target: 'Hub', value: 8 },
        { source: 'Hub', target: 'East', value: 7 },
        { source: 'Hub', target: 'West', value: 13 },
      ],
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
