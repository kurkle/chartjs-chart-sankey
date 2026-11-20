const data = [
  { flow: 10, from: 'A', to: 'B' },
  { flow: 8, from: 'B', to: 'C' },
  { flow: 6, from: 'C', to: 'A' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          // A closes the ring, but it is pinned after C: C -> A runs forward and A -> B goes back
          column: { A: 3 },
          data,
        },
      ],
    },
    type: 'sankey',
  },
  description: 'A flow that would close a cycle runs forward when its target is pinned to a later column',
  options: {
    canvas: { height: 240, width: 480 },
    spriteText: true,
  },
}
