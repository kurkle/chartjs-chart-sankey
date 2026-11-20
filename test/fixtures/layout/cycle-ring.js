const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 8, from: 'B', to: 'C' },
  { flow: 6, from: 'C', to: 'D' },
  { flow: 4, from: 'D', to: 'A' },
]

export default {
  config: {
    data: { datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data }] },
    type: 'sankey',
  },
  description: 'A ring of four nodes: the smallest flow closes the cycle and is drawn backwards',
  options: {
    canvas: { height: 220, width: 420 },
    spriteText: true,
  },
}
