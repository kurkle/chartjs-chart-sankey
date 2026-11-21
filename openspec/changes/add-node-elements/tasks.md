## 1. P1: the node element

- [ ] 1.1 Unit tests in `src/node.test.ts` that fail: the element draws its rectangle with the border and the colour of its node; it does not stroke without a border; the hit test and the centre answer for the current and for the final position
- [ ] 1.2 `NodeProps` and `NodeOptions` in `src/types.ts`
- [ ] 1.3 `NodeElement` in `src/node.ts`

## 2. P2: the controller draws from node elements

- [ ] 2.1 Browser spec `test/specs/node-elements.spec.js` that fails: one element per node with the rectangle of the geometry; the same element for the same key after a data update; the element of a removed node is gone
- [ ] 2.2 `meta.nodes`: matched by key in `update()`, assigned directly
- [ ] 2.3 The bars and the labels are drawn from the elements; `_drawNodes` is removed
- [ ] 2.4 Every existing test passes and no reference image changes

## 3. P3: the node element is public

- [ ] 3.1 Tests that fail: the registry has the element after the registering entry; the ESM entry exports it; the integration tests draw a chart with only the controller and the flow element registered; the type test names the exports
- [ ] 3.2 The export from both entries and the registration
- [ ] 3.3 `README.md` and `integration.mdx` name the element among what an application registers, and say that a chart works without it

## 4. P4: nodes and labels move with the flows

- [ ] 4.1 Browser spec `test/specs/node-animation.spec.js` that fails: after an update that changes `nodeAlign` the elements are still at the old rectangles, their final values are those of the geometry, and the animation is running; snap with `'none'`, with `animation: false`, on a resize and for a new node; a removed node is gone at once; the label side does not change during a tween. In `orientation-change.spec.js`: the nodes snap when the orientation changes
- [ ] 4.2 The elements are updated with the mode of the update, `'reset'` for a new element and when the orientation changed
- [ ] 4.3 The label side is taken from the final place of the node
- [ ] 4.4 `usage.mdx`: what moves when a chart is updated, and that an animation option that is a function of the data index does not get one for a node
- [ ] 4.5 No reference image changes
