const data = [
  { flow: 10, from: 'S1', to: 'M1' },
  { flow: 6, from: 'S2', to: 'M1' },
  { flow: 14, from: 'S3', to: 'M2' },
  { flow: 4, from: 'S4', to: 'M2' },
  { flow: 10, from: 'M1', to: 'T1' },
  { flow: 6, from: 'M1', to: 'T2' },
  { flow: 4, from: 'M2', to: 'T2' },
  { flow: 14, from: 'M2', to: 'T3' },
  // skips the middle column: its waypoint is the last slot there, so the flow
  // runs along the bottom edge and M2 comes before it
  { flow: 3, from: 'S4', to: 'T3' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data,
          nodeAlign: 'edges',
          nodePadding: 20,
        },
      ],
    },
    type: 'sankey',
  },
  description:
    "nodeAlign: 'edges' puts the first and the last slot of every column at the edges of the cross axis and the ones between them where their flows meet",
  options: {
    canvas: {
      height: 400,
      width: 700,
    },
    spriteText: true,
  },
}
