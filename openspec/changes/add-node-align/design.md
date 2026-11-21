## Context

Read from `main` at cc78618.

Where a slot (a node, or the waypoint of a flow that skips the column) sits on the cross axis is decided in `src/lib/geometry.ts`:

- `placeSlots` packs every column with its gaps and centres it in the room of the column (`base[c] + max(0, (rooms[c] - total) / 2)`), where `base` is the depth of the back flow lanes before the content and `rooms` is the axis less the lanes on both sides, per column. Then `PASSES` alternating passes call `fitColumn` with the wishes of the flows; its `rigid` flag moves a column as one block. Then, unless `rigid`, `levelSkippingFlows` (`src/lib/straighten.ts`) ties the waypoints of the flows that skip columns to one level.
- `computeGeometry` lays the lanes around the content (`placeLoops`), then shifts the whole drawing by `round((wExtent - high - low) / 2)`, so that what the scale leaves over is shared before and after it, and lays the lanes again. `low` and `high` include the outer edges of the lanes.
- Nothing in the placement knows the orientation: it works in `(u, w)` and `rect()` maps to x/y.

Readers of the one existing control, `nodePaddingMode`:

- `src/types.ts:102` (`'auto' | 'even'`), `src/controller.ts:166` (default) and `:317` (passed on as `paddingMode`), `src/lib/geometry.ts:49` (`GeometryInput.paddingMode`) and `:487` (`rigid`).
- Docs: `src/content/docs/usage.mdx` (option table, the Node Padding Mode section, the paragraph on waypoints), `src/content/docs/samples/node-padding.md`.
- Tests: `src/lib/geometry.test.ts`, `test/specs/runtime-option-updates.spec.js`, `test/types/options.ts`, `test/fixtures/node-padding-even.js`.

`GeometryInput` is not exported from the package.

In flight: pull request #496 changes `src/controller.ts`, `src/content/docs/usage.mdx`, `src/labels.ts`, `src/labels.test.ts` and label fixtures. #503 changes only `package.json` and the lockfile.

## Goals / Non-Goals

Goals:

- Columns packed at one edge of the cross axis, or pinned to both, by one option.
- The default drawing does not change by a pixel.
- `nodePaddingMode` stops growing: it is deprecated and gains no new combination.

Non-Goals:

- Removing `nodePaddingMode` or merging it into `nodeAlign`; that is for 1.0.
- Alignment along the column axis (which column a node is in); `column` and `modeX` own that.
- A value that packs the columns in the centre without aligning them.
- Changing the scale: a column keeps the room `solve` budgeted for it.

## Decisions

### One enum, read in two places of the geometry

`nodeAlign?: 'auto' | 'start' | 'end' | 'edges'` on the dataset options, default `'auto'`, not scriptable, resolved like `nodePaddingMode`. The controller passes it to `computeGeometry` as `align`, mapping anything else to `'auto'`. `placeSlots` uses it for the lead of the packed column and for which slots the passes move; `computeGeometry` uses it once more for the shift of the drawing. `solve`, the lanes, `straighten` and `fitColumn` do not change.

`start` is the start of the cross axis (top when horizontal, left when vertical), the same meaning as in `backFlows.side`.

Alternative: a separate option for the shift of the drawing. Not taken: a chart packed at the start whose drawing is then centred is not at the start, so the two cannot be chosen apart in a way that makes sense.

### The rules

With `free = max(0, rooms[c] - totals[c])`:

| Value | Lead of the packed column | Passes | Levelling |
|---|---|---|---|
| `auto` | `free / 2` | all slots, `rigid` from `nodePaddingMode` | unless `rigid` |
| `start` | `0` | none | yes |
| `end` | `free` | none | yes |
| `edges` | as `auto`; then the first slot at `0` and the last at `free` plus its packed place | the slots between the two | yes |

For `edges` a pass fits the slots `1..n-2` with their packed places and the same `free`: between two pinned slots the legal range of an inner slot is exactly its packed place plus `[0, free]`, which is what `fitColumn` already produces. The pinned slots stay, and the wishes of their neighbours still read them.

The maintainer chose packing over "anchor one end and still align the rest" for `start` and `end`, and asked for the fourth value in these words: the outermost ones packed at the start and at the end, the others in the middle automatically.

### The drawing sits at the edge too

The shift in `computeGeometry` becomes `round(-low)` for `start` and `round(wExtent - high)` for `end`; otherwise it is unchanged. `low` and `high` already hold the lanes on their side with their end gap, so the rule is right with lanes before the content, after it, or on both sides.

Without this, a chart whose scale is limited by the column axis, by the turns of the back flows or by minimum sizes would be moved back to the middle.

### Lanes before the content keep their own depth per column

With `start` and lanes before the content, a column under a lane starts after it and a column beside the lanes starts at the edge. Alternative: all columns flush at the deepest lane. Not taken: `solve` budgets the room per column, so a full column would overflow and the scale would have to change.

### Skipping flows are levelled with every value

The maintainer decided that the flows that skip columns are made level also with `start` and `end`, although a column such a flow passes is then not exactly packed. The same holds for `edges`.

### `nodePaddingMode` acts only with `auto`

`rigid = paddingMode === 'even' && align === 'auto'`. The option is deprecated (a `@deprecated` tag and a note in the docs), and a deprecated option gains no new combinations.

## Risks / Trade-offs

- `start` and `end` give up the alignment of nodes with their flows: on the densest fixture (`issues/issue72`) a prototype more than doubled how far the flows wander across the columns. The docs say so.
- With skipping flows a packed column is only nearly packed. This is the maintainer's choice; a user who wants exact packing has no switch for it.
- Under `edges`, levelling may move a pinned waypoint off its edge, and it has not been shown that it never moves a pinned node. The unit test of P1 asserts it; if it fails, the builder stops and asks.
- The prototype was tried only horizontally and only on one fixture; the vertical case and the lanes are covered by new tests.

## Pieces

| # | Builds | Files | Test that fails without it | Size | Waits on | Issues |
|---|---|---|---|---|---|---|
| P1 | The geometry takes `align`: the lead and the passes in `placeSlots`, `rigid`, the shift of the drawing. Not reachable from the options, so nothing visible changes. | `src/lib/geometry.ts`, `src/lib/geometry.test.ts` | New unit tests: `start` and `end` pack with exact gaps; the drawing sits at the edge on a short column axis; `edges` pins the first and the last slot; lanes before and after the content; a skipping flow is level under `start`; `even` with `start` still levels; one vertical case | ~175 (25 source) | nothing | none |
| P2 | The option `nodeAlign`: type, default, pass-through, docs, sample, browser tests | `src/types.ts`, `src/controller.ts`, `src/content/docs/usage.mdx`, `src/content/docs/samples/node-align.md`, `astro.config.mjs`, `test/types/options.ts`, `test/specs/runtime-option-updates.spec.js`, new fixtures `test/fixtures/node-align-*.js` | The new fixtures (the option is ignored, so the image is the `auto` one), the runtime spec, the type test | ~330 | P1, #496 | none |
| P3 | `nodePaddingMode` deprecated: the tag and the notes | `src/types.ts`, `src/content/docs/usage.mdx`, `src/content/docs/samples/node-padding.md`, `test/types/options.ts` | None can fail (a JSDoc tag and docs); the existing `nodePaddingMode` tests pass untouched | ~40 | P2, #496 | none |

P1 can be built now. P2 and P3 change files #496 holds.

## Contracts

- P1 → P2: `computeGeometry(plan, { ..., align })` accepts `'auto' | 'start' | 'end' | 'edges'` with the rules above; `align` absent means `'auto'`, and with `'auto'` every existing test and image is unchanged.
- P2 → P3: `nodeAlign` is published and documented, so the deprecation note can name it.

## Open Questions

1. (P1, P2) The name of the fourth value: `'edges'`, `'spread'`, `'justify'` or `'stretch'`. Proposed: `'edges'`.
2. (P1) A column with one slot under the fourth value: placed as `auto`, at the start, or centred. Proposed: as `auto`.
3. (P1) Whether "outermost" means slots or nodes when the outermost slot is a waypoint. Proposed: slots.
4. (P1) Levelling under the fourth value: as with the others (a pinned waypoint may leave its edge), never moving the pinned slots, or none. Proposed: as with the others.
5. (P1) A column whose minimum sizes overflow the axis under `end` or the fourth value: it starts at the start and overflows past the end as today, or it is flush at the end. Proposed: as today.
6. (P3) What the docs tell users of `nodePaddingMode: 'even'`: that it keeps working and becomes a value of `nodeAlign` in 1.0, or that `start`/`end` replace it. Proposed: the former; the latter is untrue for charts with skipping flows. And the commit type of P3: `docs` (no release) or `fix` (the tag reaches npm). Proposed: `fix`.
7. (P2, P3) Wait for #496, or build now and resolve the conflict in `usage.mdx`. Proposed: build P1 now, let P2 and P3 wait.
8. (P2) Where the sample goes: a new page, a section of the layout sample, or a section of the node padding sample. Proposed: a new page.
