const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 9, from: 'B', to: 'C' },
  { flow: 8, from: 'C', to: 'D' },
  { flow: 7, from: 'D', to: 'E' },
  { flow: 3, from: 'D', to: 'B' },
  { flow: 2, from: 'E', to: 'C' },
]

export default {
  config: {
    data: { datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data }] },
    type: 'sankey',
  },
  description: 'Two back flows whose spans overlap without one containing the other',
  options: {
    canvas: { height: 240, width: 520 },
    spriteText: true,
  },
}
