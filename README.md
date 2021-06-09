# chartjs-chart-sankey

[Chart.js](https://www.chartjs.org/) **v3.0.0-beta.10** module for creating sankey diagrams

[![npm](https://img.shields.io/npm/v/chartjs-chart-sankey.svg)](https://www.npmjs.com/package/chartjs-chart-sankey)
[![pre-release](https://img.shields.io/github/v/release/kurkle/chartjs-chart-sankey?include_prereleases&style=flat-square)](https://github.com/kurkle/chartjs-chart-sankey/releases/latest)
![Node.js CI](https://github.com/kurkle/chartjs-chart-sankey/workflows/Node.js%20CI/badge.svg)
![npm bundle size](https://img.shields.io/bundlephobia/min/chartjs-chart-sankey.svg)
![GitHub](https://img.shields.io/github/license/kurkle/chartjs-chart-sankey.svg)

## Browser support

All modern and up-to-date browsers are supported, including, but not limited to:

- Chrome
- Edge
- Firefox
- Safari

Internet Explorer 11 is not supported.

## Documentation

You can use **chartjs-chart-sankey.js** as ES module
You'll need to manually register two components

```js
import {Chart} from "chart.js";
import {SankeyController, Flow} from 'chartjs-chart-sankey/dist/chartjs-chart-sankey.esm';

Chart.register(SankeyController, Flow);
```

To create a sankey chart, include chartjs-chart-sankey.js after chart.js and then create the chart by setting the `type`
attribute to `'sankey'`

```js
new Chart(ctx, {
  type: 'sankey',
  data: dataObject
});
```

## Configuration

Example:

```js
new Chart(ctx, {
  type: 'sankey',
  data: {
    datasets: [{
      label: 'My sankey',
      data: [
        {from: 'a', to: 'b', flow: 10},
        {from: 'a', to: 'c', flow: 5},
        {from: 'b', to: 'c', flow: 10}
      ],
      colorFrom: (c) => getColor(c.dataset.data[c.dataIndex].from),
      colorTo: (c) => getColor(c.dataset.data[c.dataIndex].to),
      colorMode: 'gradient' // or 'from' or 'to'
    }]
  },
});
```

## Example

![Sankey Example Image](sankey.png)

## Online examples

[codepen](https://codepen.io/kurkle/pen/bGVKPOM)
[Vue.js 2](https://codesandbox.io/s/reverent-boyd-od2fr?file=/src/App.vue)

## Development

You first need to install node dependencies  (requires [Node.js](https://nodejs.org/)):

```bash
> npm install
```

The following commands will then be available from the repository root:

```bash
> npm run build         // build dist files
> npm run autobuild     // build and watch for changes
> npm test              // run all tests
> npm autotest          // run all tests and watch for changes
> npm lint              // perform code linting
> npm package           // create an archive with dist files and samples
```

## License

chartjs-chart-sankey is available under the [MIT license](https://opensource.org/licenses/MIT).
