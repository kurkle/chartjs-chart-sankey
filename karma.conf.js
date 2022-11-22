const istanbul = require('rollup-plugin-istanbul');
const resolve = require('@rollup/plugin-node-resolve').default;
const builds = require('./rollup.config');
const env = process.env.NODE_ENV;

module.exports = function(karma) {
  const build = builds[0];

  if (env === 'test') {
    build.plugins = [
      resolve(),
      istanbul({exclude: ['node_modules/**/*.js', 'package.json']})
    ];
  }

  karma.set({
    browsers: ['chrome', 'firefox'],
    frameworks: ['jasmine'],
    reporters: ['spec', 'kjhtml'],
    logLevel: karma.LOG_WARN,

    files: [
      {pattern: './test/fixtures/**/*.js', included: false},
      {pattern: './test/fixtures/**/*.png', included: false},
      'node_modules/chart.js/dist/chart.umd.js',
      'test/index.js',
      'src/index.js',
      'test/specs/**/*.js'
    ],

    // Explicitly disable hardware acceleration to make image
    // diff more stable when ran on Travis and dev machine.
    // https://github.com/chartjs/Chart.js/pull/5629
    customLaunchers: {
      chrome: {
        base: 'Chrome',
        flags: [
          '--disable-accelerated-2d-canvas',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      },
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
      ],
      external: [
        'chart.js'
      ],
      output: {
        format: 'umd',
        sourcemap: karma.autoWatch ? 'inline' : false,
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

  if (env === 'test') {
    karma.reporters.push('coverage');
    karma.coverageReporter = {
      dir: 'coverage/',
      reporters: [
        {type: 'html', subdir: 'html'},
        {type: 'lcovonly', subdir: (browser) => browser.toLowerCase().split(/[ /-]/)[0]}
      ]
    };
  }
};
