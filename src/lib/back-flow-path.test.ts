import {
  backFlowBounds,
  backFlowLength,
  backFlowParts,
  backFlowPath,
  isOnBackFlow,
} from './back-flow-path.js'

describe('lib/back-flow-path', () => {
  const shape = {
    c1: 50,
    c2: 60,
    clear: 6,
    lane: 200,
    reach1: 10,
    reach2: 10,
    t: 20,
    u1: 300,
    u2: 100,
  }

  it('routes stub, turn, lane, turn, stub', () => {
    const { points, radius } = backFlowPath(shape)
    expect(radius).toBe(16) // half the thickness plus the corner
    expect(points).toEqual([
      { u: 300, w: 50 },
      { u: 326, w: 50 },
      { u: 326, w: 200 },
      { u: 74, w: 200 },
      { u: 74, w: 60 },
      { u: 100, w: 60 },
    ])
  })

  it('shrinks the turns when there is not enough room across', () => {
    const { radius } = backFlowPath({ ...shape, lane: 70 })
    expect(radius).toBe(5)
  })

  it('measures the length of the center line with rounded turns', () => {
    const path = backFlowPath(shape)
    const straight = 26 + 150 + 252 + 140 + 26
    const r = path.radius
    expect(backFlowLength(path)).toBeCloseTo(straight - 8 * r + 2 * Math.PI * r, 8)
  })

  it('builds the center line from five straight runs and four quarter turns', () => {
    const parts = backFlowParts(backFlowPath(shape))
    expect(parts.map((part) => part.type)).toEqual([
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

  it('leaves out runs without length', () => {
    // turns start right at the node edge when the loop has no reach and no stub
    const parts = backFlowParts(backFlowPath({ ...shape, reach1: 0, reach2: 0 }))
    expect(parts.filter((part) => part.type === 'arc')).toHaveLength(4)
    expect(parts.filter((part) => part.type === 'line')).toHaveLength(3)
  })

  it('hits the band and nothing around it', () => {
    expect(isOnBackFlow({ u: 200, w: 200 }, shape)).toBe(true) // lane
    expect(isOnBackFlow({ u: 200, w: 209 }, shape)).toBe(true)
    expect(isOnBackFlow({ u: 200, w: 211 }, shape)).toBe(false)
    expect(isOnBackFlow({ u: 326, w: 120 }, shape)).toBe(true) // right leg
    expect(isOnBackFlow({ u: 74, w: 120 }, shape)).toBe(true) // left leg
    expect(isOnBackFlow({ u: 200, w: 120 }, shape)).toBe(false) // inside the loop
    expect(isOnBackFlow({ u: 310, w: 50 }, shape)).toBe(true) // source stub
    expect(isOnBackFlow({ u: 290, w: 50 }, shape)).toBe(false) // before the source edge
    expect(isOnBackFlow({ u: 110, w: 60 }, shape)).toBe(false) // after the target edge
    expect(isOnBackFlow({ u: 340, w: 195 }, shape)).toBe(false) // outside of a turn
    expect(isOnBackFlow({ u: 322, w: 190 }, shape)).toBe(true) // on a turn
  })

  it('has butt ends even when the band is much thicker than the turns are long', () => {
    const thick = {
      c1: 80,
      c2: 80,
      clear: 6,
      lane: 250,
      reach1: 0,
      reach2: 0,
      t: 158,
      u1: 440,
      u2: 170,
    }
    expect(isOnBackFlow({ u: 420, w: 18 }, thick)).toBe(false) // behind the source edge
    expect(isOnBackFlow({ u: 190, w: 30 }, thick)).toBe(false) // behind the target edge
    expect(isOnBackFlow({ u: 520, w: 80 }, thick)).toBe(true)
    expect(isOnBackFlow({ u: 300, w: 250 }, thick)).toBe(true)
  })

  it('has bounds that contain the band', () => {
    expect(backFlowBounds(shape)).toEqual({ uMax: 336, uMin: 64, wMax: 210, wMin: 40 })
  })

  it('keeps the turns of an outer lane further out', () => {
    const inner = backFlowPath({ ...shape, reach1: 0, reach2: 0 }).points
    const outer = backFlowPath({ ...shape, reach1: 30, reach2: 30 }).points
    expect(outer[1].u - inner[1].u).toBe(30)
    expect(inner[3].u - outer[3].u).toBe(30)
  })
})
