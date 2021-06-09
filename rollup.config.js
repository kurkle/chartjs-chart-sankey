const resolve = require('@rollup/plugin-node-resolve').default;
const terser = require('rollup-plugin-terser').terser;
const {author, name, version, homepage, main, module: _module, license} = require('./package.json');
const copy = require('rollup-plugin-copy');

const banner = `/*!
 * ${name} v${version}
 * ${homepage}
 * (c) ${(new Date(process.env.SOURCE_DATE_EPOCH ? (process.env.SOURCE_DATE_EPOCH * 1000) : new Date().getTime())).getFullYear()} ${author}
 * Released under the ${license} license
 */`;

const input = 'src/index.js';
const inputESM = 'src/index.esm.js';
const external = [
  'chart.js',
  'chart.js/helpers'
];
const globals = {
  'chart.js': 'Chart',
  'chart.js/helpers': 'Chart.helpers'
};

module.exports = [
  {
    input,
    output: {
      file: main,
      banner,
      format: 'umd',
      indent: false,
      globals
    },
    plugins: [
      resolve(),
    ],
    external
  },
  {
    input,
    output: {
      file: main.replace('.js', '.min.js'),
      format: 'umd',
      indent: false,
      globals
    },
    plugins: [
      resolve(),
      terser({
        output: {
          preamble: banner
        }
      })
    ],
    external
  },
  {
    input: inputESM,
    output: {
      file: _module,
      banner,
      format: 'esm',
      indent: false,
      globals
    },
    plugins: [
      resolve(),
      copy({
        targets: [
          {src: 'chartjs-chart-sankey.esm.d.ts', dest: 'dist/'}
        ]
      })
    ],
    external
  }
];
