import { acquireChart } from 'chartjs-test-utils'

const configs = import.meta.glob('../fixtures/**/*.js', { eager: true, import: 'default' })
const browser = navigator.userAgent.includes('Firefox') ? 'firefox' : 'chromium'

// For every fixture: paint each flow alone, opaque, on a clean canvas and compare
// the painted pixels with what inRange says about the pixel centers.
it(`hit test against the painted band (${browser})`, () => {
  let painted = 0
  let missed = 0 // painted (alpha > 250) but inRange says no
  let phantom = 0 // inRange says yes but nothing painted (alpha === 0)
  let flows = 0
  let worst = { name: '', missed: 0 }
  let ms = 0
  for (const [name, cfg] of Object.entries(configs)) {
    const chart = acquireChart(cfg.config, cfg.options)
    const { ctx, width, height } = chart
    let fixtureMissed = 0
    for (const flow of chart.getDatasetMeta(0).data) {
      flows++
      ctx.save()
      ctx.clearRect(0, 0, width, height)
      const saved = flow.options
      flow.options = { ...saved, flowColor: '#000', flowLabels: { ...saved.flowLabels, display: false } }
      flow.draw(ctx)
      flow.options = saved
      ctx.restore()
      const { data } = ctx.getImageData(0, 0, width, height)
      const t0 = performance.now()
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const alpha = data[(y * width + x) * 4 + 3]
          const hit = flow.inRange(x + 0.5, y + 0.5, false)
          if (alpha > 250) {
            painted++
            if (!hit) { missed++; fixtureMissed++ }
          } else if (alpha === 0 && hit) phantom++
        }
      }
      ms += performance.now() - t0
    }
    if (fixtureMissed > worst.missed) worst = { missed: fixtureMissed, name }
    chart.destroy()
  }
  // one mouse move asks every flow once: time that on the largest fixture
  const big = acquireChart(configs['../fixtures/issues/issue72.js'].config, configs['../fixtures/issues/issue72.js'].options)
  const all = big.getDatasetMeta(0).data
  let moves = 0
  const t1 = performance.now()
  for (let y = 5; y < big.height; y += 23) for (let x = 5; x < big.width; x += 23) { moves++; for (const f of all) f.inRange(x, y, false) }
  const perMove = (performance.now() - t1) / moves
  throw new Error(`issue72: ${all.length} flows, ${perMove.toFixed(3)} ms per mouse move; HIT ${browser}: flows ${flows}, painted px ${painted}, painted-but-not-hit ${missed} (${((100 * missed) / painted).toFixed(2)} %), hit-but-not-painted ${phantom}, worst ${worst.name} ${worst.missed}, inRange total ${ms.toFixed(0)} ms`)
})
