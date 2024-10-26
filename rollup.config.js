const resolve = require('@rollup/plugin-node-resolve').default;
const terser = require('@rollup/plugin-terser').default;
const { default: swc } = require('@rollup/plugin-swc');
const {author, name, version, homepage, main, module: _module, license} = require('./package.json');

const banner = `/*!
 * ${name} v${version}
 * ${homepage}
 * (c) ${(new Date(process.env.SOURCE_DATE_EPOCH ? (process.env.SOURCE_DATE_EPOCH * 1000) : new Date().getTime())).getFullYear()} ${author}
 * Released under the ${license} license
 */`;

const input = 'src/index.ts';
const inputESM = 'src/index.esm.ts';
const external = [
  'chart.js',
  'chart.js/helpers'
];
const globals = {
  'chart.js': 'Chart',
  'chart.js/helpers': 'Chart.helpers'
};

const swcOptions = {
  jsc: {
    parser: {
      syntax: 'typescript'
    },
    target: 'es2022'
  },
  module: {
    type: 'es6'
  },
  sourceMaps: true
}

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
      swc(swcOptions),
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
      swc(swcOptions),
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
      swc(swcOptions),
    ],
    external
  }
];
