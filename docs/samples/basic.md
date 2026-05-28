# Basic

```js chart-editor
module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          label: 'Basic sankey',
          colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
          colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
          colorMode: 'gradient',
          data: [
            { from: 'A', to: 'B', flow: 10 },
            { from: 'A', to: 'C', flow: 5 },
            { from: 'B', to: 'D', flow: 6 },
            { from: 'C', to: 'D', flow: 4 },
            { from: 'C', to: 'E', flow: 1 },
          ],
        },
      ],
    },
  },
}
```
