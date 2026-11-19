import { Chart, registerables } from 'chart.js'
import { acquireChart, afterEvent, setup, triggerMouseEvent } from 'chartjs-test-utils'

import '../src/index'

// Karma loaded the UMD bundle, which registers every Chart.js component.
Chart.register(...registerables)

// Registers the image matchers and the per-spec chart cleanup, and pins the
// backing store to CSS pixels (devicePixelRatio = 1) so the reference PNGs stay
// comparable whatever the host display reports.
setup({ Chart })

// The fixture configs and specs were written against Karma's global scope.
globalThis.Chart = Chart
globalThis.acquireChart = acquireChart
globalThis.afterEvent = afterEvent
globalThis.triggerMouseEvent = triggerMouseEvent

// Disable colors plugin for tests.
Chart.defaults.plugins.colors.enabled = false
