/* eslint-disable import/no-commonjs */
require('@babel/register');
const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve');
const builds = require('./rollup.config').default;

module.exports = function(karma) {
	const args = karma.args || {};
	const build = builds[0];

	if (args.watch) {
		build.output.sourcemap = 'inline';
	}

	karma.set({
		browsers: ['firefox'],
		frameworks: ['jasmine'],
		reporters: ['spec', 'kjhtml'],
		logLevel: karma.LOG_WARN,

		files: [
			{pattern: './test/fixtures/**/*.js', included: false},
			{pattern: './test/fixtures/**/*.png', included: false},
			'node_modules/chart.js/dist/Chart.js',
			'test/index.js',
			'src/index.js',
			'test/specs/**/*.js'
		],

		// Explicitly disable hardware acceleration to make image
		// diff more stable when ran on Travis and dev machine.
		// https://github.com/chartjs/Chart.js/pull/5629
		customLaunchers: {
			firefox: {
				base: 'Firefox',
				prefs: {
					'layers.acceleration.disabled': true
				}
			}
		},

		preprocessors: {
			'test/fixtures/**/*.js': ['fixtures'],
			'test/specs/**/*.js': ['rollup'],
			'test/index.js': ['rollup'],
			'src/index.js': ['sources']
		},

		rollupPreprocessor: {
			plugins: [
				resolve(),
				commonjs({exclude: ['src/**', 'test/**']})
			],
			external: [
				'chart.js'
			],
			output: {
				format: 'umd',
				globals: {
					'chart.js': 'Chart'
				}
			}
		},

		customPreprocessors: {
			fixtures: {
				base: 'rollup',
				options: {
					output: {
						format: 'iife',
						name: 'fixture'
					}
				}
			},
			sources: {
				base: 'rollup',
				options: build
			}
		}
	});
};
