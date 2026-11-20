const data = [
  { flow: 10, from: 'A', to: 'C' },
  { flow: 6, from: 'B', to: 'C' },
  { flow: 4, from: 'B', to: 'D' },
  { flow: 8, from: 'C', to: 'E' },
  { flow: 8, from: 'C', to: 'F' },
  { flow: 4, from: 'D', to: 'F' },
]

export default {
  config: {
    data: {
      datasets: [{ colorFrom: 'slategray', colorTo: 'orange', data, label: 'Flows' }],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'Title and legend' },
      },
    },
    type: 'sankey',
  },
  description:
    'A displayed title and legend take space from the chart area; the diagram has to fit in what is left',
  options: {
    canvas: { height: 260, width: 420 },
    spriteText: true,
  },
}
