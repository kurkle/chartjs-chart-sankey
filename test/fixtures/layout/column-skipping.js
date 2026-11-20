const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 10, from: 'B', to: 'C' },
  { flow: 10, from: 'C', to: 'D' },
  { flow: 6, from: 'A', to: 'D' },
  { flow: 4, from: 'B', to: 'D' },
  { flow: 5, from: 'A', to: 'E' },
]

export default {
  config: {
    data: { datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data }] },
    type: 'sankey',
  },
  description: 'Flows that skip columns pass over the nodes in between',
  options: {
    canvas: { height: 260, width: 460 },
    spriteText: true,
  },
}
