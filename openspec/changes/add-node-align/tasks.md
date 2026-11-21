## 1. P1: the geometry takes an alignment

- [ ] 1.1 Unit tests in `src/lib/geometry.test.ts` that fail: `start` and `end` pack every column at the edge with exact gaps; on a short column axis the drawing starts at 0 with `start` and ends at the extent with `end`; `edges` pins the first and the last slot of a column of three and of two, and leaves a column of one as `auto`; lanes before the content with `start` and after it with `end`; a skipping flow is level under `start`; `paddingMode: 'even'` with `align: 'start'` still levels; one vertical case
- [ ] 1.2 `GeometryInput.align?`, absent meaning `'auto'`
- [ ] 1.3 The lead of the packed column and the passes in `placeSlots`
- [ ] 1.4 `rigid` only with `'auto'`, and the shift of the drawing in `computeGeometry`
- [ ] 1.5 Every existing unit test and browser fixture passes unchanged

## 2. P2: the option nodeAlign

- [ ] 2.1 Fixtures `test/fixtures/node-align-start.js`, `node-align-end.js`, `node-align-edges.js` and a vertical one with back flows on the start side; a runtime test in `test/specs/runtime-option-updates.spec.js`; type tests in `test/types/options.ts`
- [ ] 2.2 The option and its doc comment in `src/types.ts`
- [ ] 2.3 The default and the pass-through in `src/controller.ts`
- [ ] 2.4 `usage.mdx`: the row of the option table and a section that says what each value gives up
- [ ] 2.5 The sample page and its sidebar entry

## 3. P3: nodePaddingMode is deprecated

- [ ] 3.1 `@deprecated` on the type, naming `nodeAlign`
- [ ] 3.2 The notes in `usage.mdx` and in the node padding sample
- [ ] 3.3 The existing `nodePaddingMode` tests and fixture pass untouched
