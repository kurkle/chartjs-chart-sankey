# chartjs-chart-sankey

[Chart.js](https://www.chartjs.org/) **v3.0.0-alpha** module for creating sankey diagrams

![npm](https://img.shields.io/npm/v/chartjs-chart-sankey.svg) [![release](https://img.shields.io/github/release/kurkle/chartjs-chart-sankey.svg?style=flat-square)](https://github.com/kurkle/chartjs-chart-sankey/releases/latest) [![travis](https://img.shields.io/travis/kurkle/chartjs-chart-sankey.svg?style=flat-square&maxAge=60)](https://travis-ci.org/kurkle/chartjs-chart-sankey) ![npm bundle size](https://img.shields.io/bundlephobia/min/chartjs-chart-sankey.svg) ![GitHub](https://img.shields.io/github/license/kurkle/chartjs-chart-sankey.svg)

## Documentation

To create a sankey chart, include chartjs-chart-sankey.js after chart.js and then create the chart by setting the `type` attribute to `'sankey'`

```js
new Chart(ctx, {
    type: 'sankey',
    data: dataObject
});
```

## Configuration

sankey chart allows configuration of `width` and `height` of the data points in addition to standard Chart.js configuration.

```js
new Chart(ctx, {
    type: 'sankey',
    data: {
        datasets: [{
            label: 'My sankey',
            data: [
                { x: 1, y: 1, v: 11 },
                { x: 2, y: 2, v: 22 },
                { x: 3, y: 3, v: 33 }
            ],
            backgroundColor: function(ctx) {
                var value = ctx.dataset.data[ctx.dataIndex].v;
                var alpha = (value - 5) / 40;
                return Color('green').alpha(alpha).rgbString();
            },
            width: function(ctx) {
                var a = ctx.chart.chartArea;
                return (a.right - a.left) / 3.5;
            },
            height: function(ctx) {
                var a = ctx.chart.chartArea;
                return (a.bottom - a.top) / 3.5;
            }
        }]
    },
});
```

## Example

![sankey Example Image](sankey.png)

## Development

You first need to install node dependencies  (requires [Node.js](https://nodejs.org/)):

```bash
> npm install
```

The following commands will then be available from the repository root:

```bash
> gulp build            // build dist files
> gulp build --watch    // build and watch for changes
> gulp test             // run all tests
> gulp test --watch     // run all tests and watch for changes
> gulp test --coverage  // run all tests and generate code coverage
> gulp lint             // perform code linting
> gulp package          // create an archive with dist files and samples
```

## License

chartjs-chart-sankey is available under the [MIT license](https://opensource.org/licenses/MIT).