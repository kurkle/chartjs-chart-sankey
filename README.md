# chartjs-chart-sankey

[![npm](https://img.shields.io/npm/v/chartjs-chart-sankey.svg)](https://www.npmjs.com/package/chartjs-chart-sankey)
[![release](https://img.shields.io/github/release/kurkle/chartjs-chart-sankey.svg?style=flat-square)](https://github.com/kurkle/chartjs-chart-sankey/releases/latest)
![npm bundle size](https://img.shields.io/bundlephobia/min/chartjs-chart-sankey.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=kurkle_chartjs-chart-sankey&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=kurkle_chartjs-chart-sankey)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=kurkle_chartjs-chart-sankey&metric=coverage)](https://sonarcloud.io/summary/new_code?id=kurkle_chartjs-chart-sankey)
[![documentation](https://img.shields.io/static/v1?message=Documentation&color=informational)](https://chartjs-chart-sankey.pages.dev)
![GitHub](https://img.shields.io/github/license/kurkle/chartjs-chart-sankey.svg)

[Chart.js](https://www.chartjs.org/) **v3.3+, v4+** module that adds a sankey chart type, drawing flows between named nodes as directional bands whose width is proportional to the flow value — useful for visualizing energy transfers, budgets, funnels, and other flow-style data, for anyone already charting with Chart.js.

## Example

![Sankey Example Image](test/fixtures/energy.png)

## Installation

```bash
npm install chartjs-chart-sankey
```

Or via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-sankey"></script>
```

## Quickstart

```js
import { Chart, LinearScale } from 'chart.js';
import { Flow, SankeyController } from 'chartjs-chart-sankey';

Chart.register(LinearScale, SankeyController, Flow);

new Chart(document.getElementById('chart'), {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'My sankey',
        data: [
          {from: 'a', to: 'b', flow: 10},
          {from: 'a', to: 'c', flow: 5},
          {from: 'b', to: 'd', flow: 6},
          {from: 'c', to: 'd', flow: 4},
        ],
      },
    ],
  },
});
```

See more integration options (script tag, other module loaders) in the [documentation](https://chartjs-chart-sankey.pages.dev/integration/).

## Documentation

You can find documentation for chartjs-chart-sankey at [https://chartjs-chart-sankey.pages.dev/](https://chartjs-chart-sankey.pages.dev/). The full dataset and options reference lives there, not in this README — this file stays a quickstart.

## Development

You first need to install node dependencies (requires [Node.js](https://nodejs.org/)):

```bash
> npm install
```

The following commands will then be available from the repository root:

```bash
> npm run build        // build dist files
> npm run autobuild     // build and watch for changes
> npm test              // run all tests
> npm run lint          // perform code linting
```

## License

chartjs-chart-sankey is available under the [MIT license](https://opensource.org/licenses/MIT).
