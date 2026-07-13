---
title: Node Labels
description: Style and position Sankey node labels.
---

Use `nodeLabels` to style labels globally, by node key, or with a callback.

```js chart-editor
module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          label: 'Node labels',
          data: [
            { from: 'Solar', to: 'Grid', flow: 12 },
            { from: 'Wind', to: 'Grid', flow: 18 },
            { from: 'Grid', to: 'Homes', flow: 17 },
            { from: 'Grid', to: 'Industry', flow: 13 },
          ],
          colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
          colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
          nodeLabels: {
            position: {
              Grid: 'center',
              Homes: 'left',
              Industry: 'left',
            },
            color: (node) => (node.key === 'Grid' ? 'white' : '#222'),
            backgroundColor: {
              Grid: '#333',
            },
            borderRadius: 4,
            padding: 5,
            font: {
              size: 12,
              weight: 'bold',
            },
          },
        },
      ],
    },
  },
}
```
