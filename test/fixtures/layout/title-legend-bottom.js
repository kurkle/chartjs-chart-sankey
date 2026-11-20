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
      datasets: [
        { colorFrom: 'slategray', colorTo: 'orange', data, label: 'Flows', orientation: 'vertical' },
      ],
    },
    options: {
      plugins: {
        legend: { display: true, position: 'right' },
        title: { display: true, position: 'bottom', text: 'Title below, legend right' },
      },
    },
    type: 'sankey',
  },
  description:
    'Vertical orientation with the title at the bottom and the legend on the right side of the chart',
  options: {
    canvas: { height: 320, width: 420 },
    spriteText: true,
  },
}
