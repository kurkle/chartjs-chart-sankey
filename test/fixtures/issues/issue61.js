module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: '#f00',
          colorTo: '#008000',
          data: [
            { flow: 1, from: '1', to: 'Alpha' },
            { flow: 1, from: '2', to: 'Beta' },
            { flow: 4, from: '3', to: 'Gamma' },
            { flow: 1, from: '5', to: 'Gamma' },
          ],
          hoverColorFrom: '#800',
          hoverColorTo: '#005000',
        },
      ],
    },
    options: {
      events: [], // disable events so it's easier to save the fixture without active elements changing
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 512,
      width: 512,
    },
    run(chart) {
      chart.setActiveElements([{ datasetIndex: 0, index: 2 }])
      chart.draw()
    },
    spriteText: true,
  },
}
