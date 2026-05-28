# Energy

```js chart-editor
module.exports = {
  config: {
    type: 'sankey',
    data: {
      datasets: [
        {
          label: 'Energy flow',
          colorFrom: (context) => Utils.getColor(context.dataset.data[context.dataIndex].from),
          colorTo: (context) => Utils.getColor(context.dataset.data[context.dataIndex].to),
          colorMode: 'gradient',
          data: [
            { from: 'Coal', to: 'Electricity', flow: 35 },
            { from: 'Gas', to: 'Electricity', flow: 25 },
            { from: 'Wind', to: 'Electricity', flow: 18 },
            { from: 'Solar', to: 'Electricity', flow: 12 },
            { from: 'Electricity', to: 'Residential', flow: 30 },
            { from: 'Electricity', to: 'Industry', flow: 40 },
            { from: 'Electricity', to: 'Transport', flow: 20 },
          ],
        },
      ],
    },
  },
}
```
