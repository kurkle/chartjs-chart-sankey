# Parsing

```js chart-editor
module.exports = {
  config: {
    type: 'sankey',
    data: {
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
    },
  },
}
```
