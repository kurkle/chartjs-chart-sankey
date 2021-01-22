const resolve = require('@rollup/plugin-node-resolve').default;
const terser = require('rollup-plugin-terser').terser;
const {author, name, version, homepage, main, module: _module, license} = require('./package.json');

const banner = `/*!
 * ${name} v${version}
 * ${homepage}
 * (c) ${(new Date(process.env.SOURCE_DATE_EPOCH ? (process.env.SOURCE_DATE_EPOCH * 1000) : new Date().getTime())).getFullYear()} ${author}
 * Released under the ${license} license
 */`;

module.exports = [
  {
    input: 'src/index.js',
    output: {
      file: main,
      banner,
      format: 'umd',
      indent: false,
      globals: {
        'chart.js': 'Chart'
      }
    },
    plugins: [
      resolve(),
    ],
    external: [
      'chart.js'
    ]
  },
  {
    input: 'src/index.js',
    output: {
      file: main.replace('.js', '.min.js'),
      format: 'umd',
      indent: false,
      globals: {
        'chart.js': 'Chart'
      }
    },
    plugins: [
      resolve(),
      terser({
        output: {
          preamble: banner
        }
      })
    ],
    external: [
      'chart.js'
    ]
  },
  {
    input: 'src/index.esm.js',
    output: {
      file: _module,
      banner,
      format: 'esm',
      indent: false,
      globals: {
        'chart.js': 'Chart'
      }
    },
    plugins: [
      resolve()
    ],
    external: (e) => e.startsWith('chart.js')
  }
];
