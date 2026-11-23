## Purpose

How the nodes of a Sankey chart, their labels and its flows move when the chart is updated, and what the element of a node is.

## ADDED Requirements

### Requirement: Nodes move with their flows

When a live chart is updated with animations on so that the place or the size of a node changes, the bar of the node SHALL move and resize over the same time as the ends of its flows. That time is the one of the geometry tween, not the column-by-column reveal of the flows.

#### Scenario: The layout changes on an update

- **WHEN** an option that moves nodes (for example `nodeAlign` or `nodePadding`) is changed and the chart is updated with animations on
- **THEN** right after the update every node that has to move is still drawn where it was
- **THEN** while the animation runs the node is drawn between its old and its new place, and its flows touch it

#### Scenario: The animation has ended

- **WHEN** the animation of an update has ended
- **THEN** the chart looks exactly as a chart drawn fresh with the new configuration

#### Scenario: A second update during the movement

- **WHEN** a chart is updated again while its nodes are moving
- **THEN** nodes and flows go on from where they are to the newest place

### Requirement: A label stays with its node

The label of a node SHALL be drawn at the place its node is drawn at, in every frame.

#### Scenario: A node moves

- **WHEN** a node moves during an update
- **THEN** its label moves with it in every frame

#### Scenario: A node crosses the middle of the chart

- **WHEN** a node whose label is positioned automatically moves from one half of the chart to the other
- **THEN** the label is on the side that belongs to the final place of the node from the first frame on

### Requirement: An update without animation ends at that update

An update with the mode `'none'` or with animations disabled SHALL put every node and every flow at the place of that update in the next frame, also while a movement is running. A resize and a change of orientation SHALL put every node at its new place at once.

#### Scenario: Animations are off

- **WHEN** a chart has animations disabled, or is updated with the mode `'none'`
- **THEN** every node and every flow is at its final place in the next frame

#### Scenario: Without animation during a movement

- **WHEN** a chart is updated with the mode `'none'` while its nodes and flows are moving
- **THEN** they are at the place of that update in the next frame and stay there

#### Scenario: Resize

- **WHEN** a chart is resized
- **THEN** every node is at its new place at once

#### Scenario: The orientation changes

- **WHEN** the orientation of a chart changes, also during a movement
- **THEN** every node is at its new place at once and the flows are revealed again

### Requirement: First render, and nodes that come and go

On a first render the nodes and their labels SHALL be at their places at once while the flows are revealed. A node that an update adds SHALL be at its place at once, and a node that an update removes SHALL be gone at once.

#### Scenario: First render

- **WHEN** a chart is drawn for the first time
- **THEN** the nodes and their labels are at their places at once while the flows are revealed

#### Scenario: A node is added

- **WHEN** an update adds a flow to a node the chart did not have
- **THEN** the new node is at its place at once

#### Scenario: A node is removed

- **WHEN** an update removes every flow of a node
- **THEN** the node is gone in the next frame

### Requirement: A flow keeps its nodes across a data update

When the data of a chart is replaced, a flow whose source and target are both still there SHALL move from where it was. Rows with the same source and target SHALL be matched in the order of the data.

#### Scenario: A row is inserted

- **WHEN** the data is replaced by the same rows with one more row in front
- **THEN** every flow that was there moves from its own old place, attached to its two nodes in every frame
- **THEN** the flow of the new row is revealed as on a first render

#### Scenario: Rows are reordered or removed

- **WHEN** the data is replaced by the same rows in another order, or without one of them
- **THEN** every remaining flow moves from its own old place, and the flow of a removed row is gone at once

#### Scenario: Parallel rows

- **WHEN** several rows have the same source and target
- **THEN** the first of them before the update is the first of them after it, and so on

### Requirement: A flow glides when it skips more or fewer columns

A forward flow whose route gains or loses a skipped column in an update SHALL change shape gradually over the animation. A flow that becomes a back flow, or stops being one, is not tweened: it SHALL change to its new shape halfway through the animation.

#### Scenario: A flow starts skipping a column

- **WHEN** an update makes a forward flow skip a column it did not skip
- **THEN** in the first frame the flow has its old shape, and halfway it is between the old and the new shape
- **THEN** in every frame the flow can be drawn and hit

#### Scenario: A flow becomes a back flow

- **WHEN** an update turns a forward flow into a back flow
- **THEN** the flow has its old shape in the first half of the animation and its new shape in the second

### Requirement: Scriptable animation options see a node

A scriptable animation option SHALL be called for a node with a context whose `type` is `'node'` and that holds the node, the chart, the dataset and the mode of the update, and no data index. The package SHALL export the type of that context and the type of a node.

#### Scenario: A delay by column

- **WHEN** the delay of the animation is a function that returns a number from the column of `context.node` when `context.type` is `'node'`
- **THEN** nodes in different columns start to move at different times

#### Scenario: A function written for flows

- **WHEN** a scriptable animation option reads the data index
- **THEN** it is still called with the data index for every flow

### Requirement: The node element is public

The package SHALL export the element of a node, and the entry that registers the controller and the flow element SHALL register it. A chart SHALL draw and animate also when only the controller and the flow element are registered. The chart SHALL keep one element per node, in the order of the nodes, where plugins and interaction modes can reach them, and an element SHALL say whether a point is on its bar.

#### Scenario: The registering entry

- **WHEN** the package is loaded through the entry that registers its parts
- **THEN** the node element is registered with Chart.js

#### Scenario: An application that registers by hand

- **WHEN** an application registers only the controller and the flow element, as the docs said before this change
- **THEN** the chart draws and its nodes animate

#### Scenario: One element per node

- **WHEN** a chart has been updated
- **THEN** the dataset meta holds one node element for every node, and the same element for a node that kept its key

#### Scenario: A point on a node

- **WHEN** a point inside the bar of a node is tested against its element
- **THEN** the element says the point is in range, at the current place or at the final one as asked
