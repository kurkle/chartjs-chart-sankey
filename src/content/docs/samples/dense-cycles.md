---
title: Dense Cycles
description: A busy network with many flows and loops, where the flow under the mouse is highlighted.
---

This is a busy network: six stages of mines, crushers, smelters, casters, mills and shops, with flows that skip stages, thin flows next to thick ones, and loops that carry scrap and returns back to earlier stages. Move the mouse over the chart and the flow under it is highlighted and named in the tooltip, thin bands, runs across skipped stages and lanes around the chart included.

The choices change how the loops are drawn: `orientation` turns the chart, `backFlows.bundle` gives the loops into one node a shared lane, and `backFlows.side` runs the lanes after the content, before it, or on the side nearer to each loop.

```js chart-editor height=640
// <block:data:1>
// Mulberry32: the same flows on every load
function random(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = random(2024)
const stages = [
  ['Mine A', 'Mine B', 'Mine C'],
  ['Crush 1', 'Crush 2', 'Crush 3', 'Crush 4'],
  ['Smelt 1', 'Smelt 2', 'Smelt 3', 'Smelt 4'],
  ['Cast 1', 'Cast 2', 'Cast 3', 'Cast 4'],
  ['Mill 1', 'Mill 2', 'Mill 3'],
  ['Shop 1', 'Shop 2', 'Shop 3'],
]
const size = (max) => Math.max(1, Math.round(rnd() ** 3 * max))
const seen = new Set()
const flows = []
const add = (from, to, flow) => {
  if (seen.has(`${from}>${to}`)) return
  seen.add(`${from}>${to}`)
  flows.push({ from, to, flow })
}
// forward flows: each node feeds three nodes of the next stage, and now and then one two stages on
stages.forEach((names, s) => {
  for (const from of names) {
    const next = stages[s + 1]
    if (!next) continue
    for (const to of [...next].sort(() => rnd() - 0.5).slice(0, 3)) add(from, to, size(60))
    const far = stages[s + 2]
    if (far && rnd() < 0.5) add(from, far[Math.floor(rnd() * far.length)], size(20))
  }
})
// loops: scrap and returns go back to earlier stages, and several go back to the same node
const back = (s, t, n) => {
  for (let i = 0; i < n; i++) {
    const from = stages[s][Math.floor(rnd() * stages[s].length)]
    add(from, stages[t][Math.floor(rnd() * stages[t].length)], size(8))
  }
}
back(5, 2, 3)
back(4, 1, 3)
back(3, 1, 1)
back(4, 3, 1)
back(3, 2, 1)
for (const from of ['Smelt 2', 'Smelt 3']) add(from, 'Crush 2', size(6))
add('Cast 4', 'Crush 2', 3)
add('Mill 2', 'Crush 2', 2)
add('Smelt 3', 'Smelt 3', 4)
add('Shop 1', 'Shop 1', 2)
// every node sits in its stage, so the loops are the flows that go back to an earlier one
const column = {}
stages.forEach((names, s) => {
  for (const name of names) column[name] = s
})
// </block:data>

// <block:config:0>
const config = {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Dense cycles',
        orientation: 'horizontal',
        backFlows: { bundle: false, side: 'end' },
        column,
        data: flows,
        hoverFlowColor: 'rgb(220, 20, 60)',
      },
    ],
  },
  options: {
    colorFrom: (context) => Utils.getColor(context.raw.from),
    colorTo: (context) => Utils.getColor(context.raw.to),
    colorMode: 'gradient',
  },
}
// </block:config>

module.exports = {
  config,
  choices: [
    { path: 'data.datasets.0.orientation', values: ['horizontal', 'vertical'], control: 'radio' },
    { path: 'data.datasets.0.backFlows.bundle', label: 'backFlows.bundle', values: [false, true], control: 'checkbox' },
    { path: 'data.datasets.0.backFlows.side', label: 'backFlows.side', values: ['end', 'start', 'auto'], control: 'radio' },
  ],
}
```
