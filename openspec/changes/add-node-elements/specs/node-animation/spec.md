## Purpose

How the nodes of a Sankey chart and their labels move when the chart is updated, and what the element of a node is.

## ADDED Requirements

### Requirement: Nodes move with their flows

When a live chart is updated so that the place or the size of a node changes, and animations are on, the bar of the node SHALL move and resize over the same time as the flows attached to it.

#### Scenario: The layout changes on an update

- **WHEN** an option that moves nodes (for example `nodeAlign` or `nodePadding`) or the data is changed and the chart is updated with animations on
- **THEN** right after the update every node that has to move is still drawn where it was
- **THEN** while the animation runs the node is drawn between its old and its new place

#### Scenario: The animation has ended

- **WHEN** the animation of an update has ended
- **THEN** the chart looks exactly as a chart drawn fresh with the new configuration

### Requirement: A label stays with its node

The label of a node SHALL be drawn at the place its node is drawn at, in every frame.

#### Scenario: A node moves

- **WHEN** a node moves during an update
- **THEN** its label moves with it in every frame

#### Scenario: A node crosses the middle of the chart

- **WHEN** a node whose label is positioned automatically moves from one half of the chart to the other
- **THEN** the label is on the side that belongs to the final place of the node from the first frame on

### Requirement: Nothing moves where nothing moved before

A first render, an update without animations, a resize and a change of orientation SHALL put every node at its final place at once, as before.

#### Scenario: First render

- **WHEN** a chart is drawn for the first time
- **THEN** the nodes and their labels are at their places at once while the flows are revealed

#### Scenario: Animations are off

- **WHEN** a chart has animations disabled, or is updated with the mode `'none'`
- **THEN** every node is at its final place in the next frame

#### Scenario: Resize

- **WHEN** a chart is resized
- **THEN** every node is at its new place at once

#### Scenario: The orientation changes

- **WHEN** the orientation of a chart changes
- **THEN** every node is at its new place at once and the flows are revealed again

### Requirement: Nodes that come and go

A node that an update adds SHALL be at its place at once, and a node that an update removes SHALL be gone at once. A node that keeps its key SHALL move from where it was.

#### Scenario: A node is added

- **WHEN** an update adds a flow to a node the chart did not have
- **THEN** the new node is at its place at once and its flows are revealed

#### Scenario: A node is removed

- **WHEN** an update removes every flow of a node
- **THEN** the node is gone in the next frame

#### Scenario: A node keeps its key

- **WHEN** the flows around a node change and the node keeps its key
- **THEN** the node moves from where it was to its new place

### Requirement: The node element is public

The package SHALL export the element of a node, and the entry that registers the controller and the flow element SHALL register it. A chart SHALL draw and animate also when only the controller and the flow element are registered. The chart SHALL keep one element per node, in the order of the nodes, where plugins and interaction modes can reach them.

#### Scenario: The registering entry

- **WHEN** the package is loaded through the entry that registers its parts
- **THEN** the node element is registered with Chart.js

#### Scenario: An application that registers by hand

- **WHEN** an application registers only the controller and the flow element, as the docs said before this change
- **THEN** the chart draws and its nodes animate

#### Scenario: One element per node

- **WHEN** a chart has been updated
- **THEN** the dataset meta holds one node element for every node that is drawn, and the same element for a node that kept its key
