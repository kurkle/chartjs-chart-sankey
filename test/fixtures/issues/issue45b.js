module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { flow: 15, from: 'TEST1', to: 'TEST2' },
            { flow: 20, from: 'TEST3', to: 'TEST2' },
            { flow: 25, from: 'TEST4', to: 'TEST2' },
            { flow: 25, from: 'TEST4', to: 'TEST5' },
            { flow: 60, from: 'TEST2', to: 'TEST6' },
            { flow: 25, from: 'TEST5', to: 'TEST6' },
            { flow: 25, from: 'TEST7', to: 'TEST6' },
          ],
        },
      ],
    },
    type: 'sankey',
  },
  options: {
    canvas: {
      height: 256,
      width: 512,
    },
    spriteText: true,
  },
}
