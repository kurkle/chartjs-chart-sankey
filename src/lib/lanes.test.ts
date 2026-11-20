import { assignLanes } from './lanes.js'

const loop = (index: number, from: number, to: number) => ({ from, index, to })

describe('lib/lanes', () => {
  it('needs no lanes without loops', () => {
    expect(assignLanes([]).size).toBe(0)
  })

  it('puts a single loop in the innermost lane', () => {
    expect(assignLanes([loop(4, 2, 1)]).get(4)).toBe(0)
  })

  it('puts the shortest loop innermost so that nested loops do not cross', () => {
    const lanes = assignLanes([loop(0, 3, 0), loop(1, 2, 1)])
    expect(lanes.get(1)).toBe(0)
    expect(lanes.get(0)).toBe(1)
  })

  it('keeps the data order between loops of equal length', () => {
    const lanes = assignLanes([loop(0, 3, 2), loop(1, 2, 1)])
    expect(lanes.get(0)).toBe(0)
    expect(lanes.get(1)).toBe(1)
  })

  it('lets loops that have a whole column between them share a lane', () => {
    const lanes = assignLanes([loop(0, 1, 0), loop(1, 4, 3)])
    expect(lanes.get(0)).toBe(0)
    expect(lanes.get(1)).toBe(0)
  })

  it('keeps loops in neighbouring columns apart', () => {
    const lanes = assignLanes([loop(0, 1, 0), loop(1, 2, 1)])
    expect(lanes.get(0)).toBe(0)
    expect(lanes.get(1)).toBe(1)
  })

  it('has no limit on the number of lanes', () => {
    const loops = Array.from({ length: 40 }, (_, i) => loop(i, 5, 0))
    const lanes = assignLanes(loops)
    expect(new Set(lanes.values()).size).toBe(40)
  })
})
