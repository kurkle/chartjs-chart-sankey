import type { LoopVertex } from '../types.js'

import { fitRadii, isOnParts, longestRun, loopBounds, loopLength, loopParts } from './loop-path.js'

const corner = (u: number, w: number, r = 16): LoopVertex => ({ r, u, w })
const end = (u: number, w: number): LoopVertex => ({ r: 0, u, w })

describe('lib/loop-path', () => {
  // out of the source edge, a turn, a run through the slots, a turn into the target edge
  const line = [
    end(300, 50),
    corner(326, 50),
    corner(326, 200),
    corner(74, 200),
    corner(74, 60),
    end(100, 60),
  ]
  const t = 20

  it('builds the centre line from five straight runs and four quarter turns', () => {
    expect(loopParts(line).map((part) => part.type)).toEqual([
      'line',
      'arc',
      'line',
      'arc',
      'line',
      'arc',
      'line',
      'arc',
      'line',
    ])
  })

  it('measures the length of the centre line with rounded corners', () => {
    const straight = 26 + 150 + 252 + 140 + 26
    expect(loopLength(loopParts(line))).toBeCloseTo(straight - 8 * 16 + 2 * Math.PI * 16, 8)
  })

  it('leaves out runs without length', () => {
    // corners right at the ends of the runs leave no straight part between them
    const parts = loopParts([end(0, 0), corner(10, 0, 10), corner(10, 20, 10), end(0, 20)])
    expect(parts.filter((part) => part.type === 'arc')).toHaveLength(2)
    expect(parts.filter((part) => part.type === 'line')).toHaveLength(0)
  })

  it('hits the band and nothing around it', () => {
    const parts = loopParts(line)
    const on = (u: number, w: number) => isOnParts({ u, w }, parts, t / 2)
    expect(on(200, 200)).toBe(true) // the run
    expect(on(200, 209)).toBe(true)
    expect(on(200, 211)).toBe(false)
    expect(on(326, 120)).toBe(true) // right leg
    expect(on(74, 120)).toBe(true) // left leg
    expect(on(200, 120)).toBe(false) // inside the loop
    expect(on(310, 50)).toBe(true) // out of the source
    expect(on(290, 50)).toBe(false) // before the source edge
    expect(on(110, 60)).toBe(false) // after the target edge
    expect(on(340, 195)).toBe(false) // outside of a turn
    expect(on(322, 190)).toBe(true) // on a turn
  })

  it('has bounds that contain the band', () => {
    expect(loopBounds(line, t)).toEqual({ uMax: 336, uMin: 64, wMax: 210, wMin: 40 })
  })

  it('finds the longest run along the columns', () => {
    expect(longestRun(line)).toEqual([line[2], line[3]])
    expect(longestRun([end(0, 0), end(0, 10)])).toBeUndefined()
  })

  describe('fitRadii', () => {
    it('drops vertices that repeat or lie on a straight run', () => {
      const fitted = fitRadii([end(0, 0), corner(10, 0), corner(10, 0), corner(10, 30), end(0, 30)])
      expect(fitted.map(({ u, w }) => [u, w])).toEqual([
        [0, 0],
        [10, 0],
        [10, 30],
        [0, 30],
      ])
      expect(fitRadii([end(0, 0), corner(5, 0), end(10, 0)])).toHaveLength(2)
    })

    it('cuts a radius to the room its runs leave it', () => {
      // a run between two corners is shared by them, a run that ends the line is theirs alone
      const fitted = fitRadii([end(0, 0), corner(20, 0), corner(20, 8), end(0, 8)])
      expect(fitted.map((p) => p.r)).toEqual([0, 4, 4, 0])
    })

    it('keeps a radius that fits', () => {
      const fitted = fitRadii([end(0, 0), corner(40, 0, 5), corner(40, 40, 5), end(0, 40)])
      expect(fitted.map((p) => p.r)).toEqual([0, 5, 5, 0])
    })
  })
})
