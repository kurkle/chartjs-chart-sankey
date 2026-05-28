module.exports = {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'red',
          colorTo: 'green',
          data: [
            { flow: 15, from: 'TEST2', to: 'TEST1' },
            { flow: 20, from: 'TEST2', to: 'TEST3' },
            { flow: 25, from: 'TEST2', to: 'TEST4' },
            { flow: 25, from: 'TEST5', to: 'TEST4' },
            { flow: 60, from: 'TEST6', to: 'TEST2' },
            { flow: 25, from: 'TEST6', to: 'TEST5' },
            { flow: 25, from: 'TEST6', to: 'TEST7' },
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
