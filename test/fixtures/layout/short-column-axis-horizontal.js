const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 10, from: 'B', to: 'C' },
  { flow: 8, from: 'C', to: 'D' },
  { flow: 8, from: 'D', to: 'E' },
  { flow: 3, from: 'E', to: 'B' },
]

export default {
  config: {
    data: { datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data }] },
    type: 'sankey',
  },
  description: 'Five columns on a column axis only 160px wide, with a back flow',
  options: {
    canvas: { height: 260, width: 160 },
    spriteText: true,
  },
}
