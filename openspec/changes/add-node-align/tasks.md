## 1. P1: the geometry takes an alignment

- [x] 1.1 Unit tests in `src/lib/geometry.test.ts` that fail:
  - `start` and `end` pack every column at the edge with exactly the requested gaps
  - on a short column axis the drawing starts at 0 with `start` and ends at the extent with `end`
  - a column whose minimum sizes do not fit: all of the overflow is past the end with `start` and before the start with `end`
  - `edges`: the first and the last slot of a column of three and of two are at the edges, the inner ones keep the gap; the only slot of a column is at the edge nearer to its flows; an outermost waypoint is at the edge; the drawing is centred on an axis it does not fill; levelling does not move a pinned node
  - lanes before and after the content, each with `start` and with `end`
  - a skipping flow is level under `start`; `paddingMode: 'even'` with `align: 'start'` still levels; `'even'` with `'auto'` still does not
  - one vertical case
- [x] 1.2 `GeometryInput.align?`, absent meaning `'auto'`, resolved once with `paddingMode` in `computeGeometry`
- [x] 1.3 The lead of the packed column and the slots the passes move, in `placeSlots`
- [x] 1.4 The shift of the drawing from the same lead
- [x] 1.5 Every existing unit test and browser fixture passes unchanged

## 2. P2: the option nodeAlign, and nodePaddingMode deprecated

- [ ] 2.1 Tests that fail: fixtures `test/fixtures/node-align-edges.js` and a vertical `node-align-start` with back flows before the content; in `test/specs/runtime-option-updates.spec.js` a change of `nodeAlign` at runtime, `end` (the last node of every column at the edge) and an unknown value drawn as `auto`; type tests in `test/types/options.ts`
- [ ] 2.2 The option and its doc comment in `src/types.ts`; `@deprecated` on `nodePaddingMode` (keeps working until 1.0, removed there, `nodeAlign: 'start'` and `'end'` give the requested gaps)
- [ ] 2.3 The default and the pass-through in `src/controller.ts`
- [ ] 2.4 `usage.mdx`: the row of the option table; a section that says what each value does and gives up, and that it is about the cross axis; the sentences that state the old rule (`:133` "in `auto` mode", `:156` and `:166` in the Node Padding Mode section, `:230` on waypoints and `'even'`) say which `nodeAlign` they hold for; the deprecation note
- [ ] 2.5 The sample page `samples/node-align.md` and its sidebar entry; the node padding sample says its numbers hold for `nodeAlign: 'auto'` and carries the deprecation note
- [ ] 2.6 The existing `nodePaddingMode` tests and fixture pass untouched
