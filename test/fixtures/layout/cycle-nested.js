const data = [
  { flow: 12, from: 'A', to: 'B' },
  { flow: 10, from: 'B', to: 'C' },
  { flow: 8, from: 'C', to: 'D' },
  { flow: 5, from: 'D', to: 'C' },
  { flow: 3, from: 'D', to: 'B' },
  { flow: 2, from: 'D', to: 'A' },
]

export default {
  config: {
    data: { datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data }] },
    type: 'sankey',
  },
  description: 'Back flows of different lengths nested inside each other',
  options: {
    canvas: { height: 240, width: 480 },
    spriteText: true,
  },
}
