const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 6, from: 'B', to: 'C' },
  { flow: 4, from: 'B', to: 'D' },
  { flow: 3, from: 'C', to: 'D' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          // C and D share a column although C feeds D
          backFlows: { side: 'start' },
          column: { C: 2, D: 2 },
          data,
        },
      ],
    },
    type: 'sankey',
  },
  description: 'A flow between two nodes pinned to the same column, with the lanes before the content',
  options: {
    canvas: { height: 220, width: 420 },
    spriteText: true,
  },
}
