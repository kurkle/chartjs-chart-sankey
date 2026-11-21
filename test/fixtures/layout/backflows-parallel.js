const data = [
  { flow: 30, from: 'A', to: 'B' },
  { flow: 30, from: 'B', to: 'C' },
  { flow: 30, from: 'C', to: 'D' },
  { flow: 8, from: 'D', to: 'B' },
  { flow: 6, from: 'D', to: 'B' },
  { flow: 5, from: 'C', to: 'B' },
  { flow: 4, from: 'D', to: 'A' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: '#4e79a7',
          colorTo: '#f28e2b',
          data,
        },
      ],
    },
    type: 'sankey',
  },
  description: 'Two back flows between the same nodes share a lane and turn concentrically',
  options: {
    canvas: { height: 340, width: 620 },
    spriteText: true,
  },
}
