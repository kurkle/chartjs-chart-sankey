# Labels

```js chart-editor
module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          label: 'Labels',
          colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
          colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
          colorMode: 'from',
          labels: {
            raw: 'Raw material',
            processed: 'Processed',
            shipped: 'Shipped',
            recycled: 'Recycled',
          },
          data: [
            { from: 'raw', to: 'processed', flow: 20 },
            { from: 'processed', to: 'shipped', flow: 14 },
            { from: 'processed', to: 'recycled', flow: 6 },
          ],
        },
      ],
    },
  },
}
```
