const palette = ['#4f8fba', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2']
const assigned = new Map()

export function getColor(name) {
  if (!assigned.has(name)) {
    assigned.set(name, palette[assigned.size % palette.length])
  }
  return assigned.get(name)
}
