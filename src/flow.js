import Chart from 'chart.js';
const color = Chart.helpers.color;

const controlPoints = (x, y, x2, y2) => ({
	cp1: {x: x + (x2 - x) / 3 * 2, y},
	cp2: {x: x + (x2 - x) / 3, y: y2}
});

const pointInLine = (p1, p2, t) => ({x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y)});

export default class Flow extends Chart.Element {

	static _type = 'flow';

	constructor(cfg) {
		super();

		this.options = undefined;
		this.x = undefined;
		this.y = undefined;
		this.x2 = undefined;
		this.y2 = undefined;
		this.height = undefined;

		if (cfg) {
			Object.assign(this, cfg);
		}
	}

	draw(ctx) {
		const me = this;
		const {x, x2, y, y2, height, progress} = me;
		const {cp1, cp2} = controlPoints(x, y, x2, y2);
		const options = me.options;

		if (progress === 0) {
			return;
		}
		ctx.save();
		if (progress < 1) {
			ctx.beginPath();
			ctx.rect(x, Math.min(y, y2), (x2 - x) * progress + 1, Math.abs(y2 - y) + height + 1);
			ctx.clip();
		}
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2);
		ctx.lineTo(x2, y2 + height);
		ctx.bezierCurveTo(cp2.x, cp2.y + height, cp1.x, cp1.y + height, x, y + height);
		ctx.lineTo(x, y);
		ctx.closePath();

		const fill = ctx.createLinearGradient(x, 0, x2, 0);
		fill.addColorStop(0, color(options.colorFrom).alpha(0.5).rgbString());
		fill.addColorStop(1, color(options.colorTo).alpha(0.5).rgbString());
		ctx.fillStyle = fill;
		ctx.fill();

		ctx.restore();
	}

	inRange(mouseX, mouseY, useFinalPosition) {
		const {x, y, x2, y2, height} = this.getProps(['x', 'y', 'x2', 'y2', 'height'], useFinalPosition);
		if (mouseX < x || mouseX > x2) {
			return false;
		}
		const {cp1, cp2} = controlPoints(x, y, x2, y2);
		const t = (mouseX - x) / (x2 - x);
		const p1 = {x, y};
		const p2 = {x: x2, y: y2};
		const a = pointInLine(p1, cp1, t);
		const b = pointInLine(cp1, cp2, t);
		const c = pointInLine(cp2, p2, t);
		const d = pointInLine(a, b, t);
		const e = pointInLine(b, c, t);
		const topY = pointInLine(d, e, t).y;
		return mouseY >= topY && mouseY <= topY + height;
	}

	inXRange(mouseX, useFinalPosition) {
		const {x, x2} = this.getProps(['x', 'x2'], useFinalPosition);
		return mouseX >= x && mouseX <= x2;
	}

	inYRange(mouseY, useFinalPosition) {
		const {y, y2, height} = this.getProps(['y', 'y2', 'height'], useFinalPosition);
		const minY = Math.min(y, y2);
		const maxY = Math.max(y, y2) + height;
		return mouseY >= minY && mouseY <= maxY;
	}

	getCenterPoint(useFinalPosition) {
		const {x, y, x2, y2} = this.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition);
		return {
			x: (x + x2) / 2,
			y: (y + y2) / 2
		};
	}

	tooltipPosition() {
		return this.getCenterPoint();
	}

	getRange(axis) {
		return axis === 'x' ? this.width / 2 : this.height / 2;
	}
}
