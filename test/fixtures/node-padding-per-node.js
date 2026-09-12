const data = [
  { flow: 15, from: 'Oil', to: 'Fossil fuels' },
  { flow: 20, from: 'Natural gas', to: 'Fossil fuels' },
  { flow: 25, from: 'Coal', to: 'Fossil fuels' },
  { flow: 60, from: 'Fossil fuels', to: 'Energy' },
  { flow: 10, from: 'Nuclear', to: 'Energy' },
  { flow: 30, from: 'Renewables', to: 'Energy' },
  { flow: 40, from: 'Energy', to: 'Electricity' },
  { flow: 35, from: 'Energy', to: 'Heat' },
  { flow: 25, from: 'Energy', to: 'Lost' },
]

export default {
  config: {
    data: {
      datasets: [
        {
          colorFrom: 'slategray',
          colorTo: 'orange',
          data,
          // A Record of per-node gaps: only Natural gas gets a wide gap
          // below it (widening the Natural gas -> Oil gap, the last column-0
          // pair; Coal above Natural gas is unaffected), and Heat gets a
          // wide gap above it (widening the Electricity -> Heat gap in the
          // last column). Everything else uses the default 10px symmetric
          // gap.
          nodePadding: {
            Heat: { before: 40 },
            'Natural gas': { after: 40 },
          },
        },
      ],
    },
    type: 'sankey',
  },
  description:
    'per-node nodePadding: a Record of before/after gaps widens the gap below "Natural gas" and above "Heat" only, leaving the other gaps at the 10px default',
  options: {
    canvas: {
      height: 500,
      width: 900,
    },
    // Node labels are incidental to what this fixture measures (gaps between
    // nodes), not the point of comparison. Real font rasterization differs
    // between the CI Linux runner and a local macOS run enough to blow the
    // 0.1% pixel tolerance on nine long labels, so draw them from the
    // deterministic bitmap sprite sheet instead, like the other fixtures
    // with sizeable text (see `grep -l 'spriteText: true' test/fixtures/*.js`).
    spriteText: true,
  },
}
