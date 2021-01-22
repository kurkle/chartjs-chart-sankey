/* eslint-disable import/no-commonjs */
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';
import {name, version, homepage, author, license} from './package.json';

const banner = `/*!
 * ${name} v${version}
 * ${homepage}
 * (c) ${(new Date(process.env.SOURCE_DATE_EPOCH ? (process.env.SOURCE_DATE_EPOCH * 1000) : new Date().getTime())).getFullYear()} ${author}
 * Released under the ${license} license
 */`;

export default [
  {
    input: 'src/index.js',
    output: {
      file: `dist/${name}.js`,
      banner,
      format: 'umd',
      indent: false,
      globals: {
        'chart.js': 'Chart'
      }
    },
    plugins: [
      resolve(),
      babel({babelHelpers: 'bundled'}),
    ],
    external: [
      'chart.js'
    ]
  },
  {
    input: 'src/index.js',
    output: {
      file: `dist/${name}.min.js`,
      format: 'umd',
      indent: false,
      globals: {
        'chart.js': 'Chart'
      }
    },
    plugins: [
      resolve(),
      babel({babelHelpers: 'bundled'}),
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
      file: `dist/${name}.esm.js`,
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
