const data = [
  { flow: 40, from: 'Mine', to: 'Smelter' },
  { flow: 30, from: 'Smelter', to: 'Parts' },
  { flow: 10, from: 'Smelter', to: 'Slag' },
  { flow: 30, from: 'Parts', to: 'Machines' },
  { flow: 18, from: 'Machines', to: 'Scrap' },
  { flow: 12, from: 'Machines', to: 'Exported' },
  { flow: 12, from: 'Scrap', to: 'Smelter' },
  { flow: 6, from: 'Parts', to: 'Smelter' },
  { flow: 60, from: 'Farm', to: 'Market' },
  { flow: 60, from: 'Market', to: 'Shop' },
  { flow: 60, from: 'Shop', to: 'Home' },
  { flow: 10, from: 'Home', to: 'Market' },
  { flow: 6, from: 'Shop', to: 'Market' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          backFlows: { side: 'auto' },
          colorFrom: '#4e79a7',
          colorTo: '#f28e2b',
          data,
        },
      ],
    },
    type: 'sankey',
  },
  description: 'Each lane runs on the side nearer to its ends',
  options: {
    canvas: { height: 340, width: 620 },
    spriteText: true,
  },
}
