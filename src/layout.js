
export function calculateX(nodes, data) {
	const to = new Set(data.map(x => x.to));
	const from = new Set(data.map(x => x.from));
	const keys = new Set([...nodes.keys()]);
	let x = 0;
	while (keys.size) {
		const column = [...keys].filter(key => !to.has(key));
		for (let i = 0; i < column.length; i++) {
			nodes.get(column[i]).x = x;
			keys.delete(column[i]);
		}
		if (keys.size) {
			to.clear();
			data.filter(flow => keys.has(flow.from)).forEach(flow => to.add(flow.to));
			x++;
		}
	}
	[...nodes.keys()]
		.filter(key => !from.has(key))
		.forEach(key => {
			nodes.get(key).x = x;
		});

	return x;
}

const nodeByXY = (a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y;
const nodeCount = (list, prop) => list.reduce((acc, cur) => acc + cur.node[prop].length + nodeCount(cur.node[prop], prop), 0);
const flowByNodeCount = (prop) => (a, b) => nodeCount(a.node[prop], prop) - nodeCount(b.node[prop], prop);

function findLargestNode(nodeArray) {
	return nodeArray.sort((a, b) => Math.max(b.in, b.out) - Math.max(a.in, a.out))[0];
}

function processFrom(node, y) {
	node.from.sort(flowByNodeCount('from')).forEach(flow => {
		const n = flow.node;
		if (!('y' in n)) {
			n.y = y;
			y = Math.max(y + n.out, processFrom(n, y));
		}
	});
	return y;
}

function processTo(node, y) {
	node.to.sort(flowByNodeCount('to')).forEach(flow => {
		const n = flow.node;
		if (!('y' in n)) {
			n.y = y;
			y = Math.max(y + n.in, processTo(n, y));
		}
	});
	return y;
}

function processRest(nodeArray, maxX) {
	const leftNodes = nodeArray.filter(node => node.x === 0);
	const rightNodes = nodeArray.filter(node => node.x === maxX);

	let leftY = leftNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.out) || 0), 0);
	let rightY = rightNodes.reduce((acc, cur) => Math.max(acc, (cur.y + cur.out) || 0), 0);

	if (leftY >= rightY) {
		leftNodes.filter(node => !('y' in node)).forEach(n => {
			n.y = leftY;
			leftY = Math.max(leftY + n.out, processTo(n, leftY));
		});

		rightNodes.filter(node => !('y' in node)).forEach(n => {
			n.y = rightY;
			rightY = Math.max(rightY + n.in, processTo(n, rightY));
		});
	} else {
		rightNodes.filter(node => !('y' in node)).forEach(n => {
			n.y = rightY;
			rightY = Math.max(rightY + n.in, processTo(n, rightY));
		});

		leftNodes.filter(node => !('y' in node)).forEach(n => {
			n.y = leftY;
			leftY = Math.max(leftY + n.out, processTo(n, leftY));
		});
	}

	return Math.max(leftY, rightY);
}

export function calculateY(nodeArray, maxX) {
	const start = findLargestNode(nodeArray);
	start.y = 0;
	const left = processFrom(start, 0);
	const right = processTo(start, 0);
	const rest = processRest(nodeArray, maxX);
	return Math.max(left, right, rest);
}

export function maxRows(nodeArray, maxX) {
	let max = 0;
	for (let i = 0; i <= maxX; i++) {
		max = Math.max(max, nodeArray.filter(n => n.x === i).length);
	}
	return max;
}

export function addPadding(nodeArray, padding) {
	let i = 1;
	let x = 0;
	let prev = 0;
	const rows = [];
	nodeArray.sort(nodeByXY).forEach(node => {
		if (node.y) {
			if (node.x === 0) {
				rows.push(node.y);
			} else {
				if (x !== node.x) {
					x = node.x;
					prev = 0;
				}

				for (i = prev + 1; i < rows.length; i++) {
					if (rows[i] > node.y) {
						break;
					}
				}
				prev = i;
			}
			node.y += i * padding;
			i++;
		}
	});
}

export function sortFlows(nodeArray) {
	nodeArray.forEach(node => {
		let addY = 0;
		node.from.sort((a, b) => (a.node.y + a.node.out / 2) - (b.node.y + b.node.out / 2)).forEach(flow => {
			flow.addY = addY;
			addY += flow.flow;
		});
		addY = 0;
		node.to.sort((a, b) => (a.node.y + a.node.in / 2) - (b.node.y + b.node.in / 2)).forEach(flow => {
			flow.addY = addY;
			addY += flow.flow;
		});
	});
}

export function layout(nodes, data) {
	const nodeArray = [...nodes.values()];
	const maxX = calculateX(nodes, data);
	const maxY = calculateY(nodeArray, maxX);
	const rows = maxRows(nodeArray, maxX);
	const padding = maxY * 0.03; // rows;

	addPadding(nodeArray, padding);
	sortFlows(nodeArray);

	return {maxX, maxY: maxY + rows * padding};
}
