export type SketchPoint = [number, number];

type BaseElement = {
	id?: string;
	color?: string;
	opacity?: number;
};

export type SketchStrokeElement = BaseElement & {
	type: "stroke" | "highlight";
	points: SketchPoint[];
	size?: number;
};

export type SketchLineElement = BaseElement & {
	type: "line" | "arrow";
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	size?: number;
};

export type SketchShapeElement = BaseElement & {
	type: "rect" | "ellipse";
	x: number;
	y: number;
	width: number;
	height: number;
	stroke?: string;
	fill?: string;
	size?: number;
};

export type SketchTextElement = BaseElement & {
	type: "text";
	x: number;
	y: number;
	text: string;
	size?: number;
	font?: string;
};

export type SketchElement =
	| SketchStrokeElement
	| SketchLineElement
	| SketchShapeElement
	| SketchTextElement;

export type SketchDocument = {
	version: 1;
	width: number;
	height: number;
	background?: string;
	elements: SketchElement[];
};

const DEFAULT_STROKE_COLOR = "#334155";
const DEFAULT_HIGHLIGHT_COLOR = "#facc15";
const DEFAULT_STROKE_SIZE = 4;
const DEFAULT_TEXT_SIZE = 28;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function optionalString(value: unknown, fieldName: string): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a string`);
	}
	return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number`);
	}
	return value;
}

function requiredNumber(value: unknown, fieldName: string): number {
	if (!isFiniteNumber(value)) {
		throw new Error(`${fieldName} must be a finite number`);
	}
	return value;
}

function validatePoint(value: unknown, fieldName: string): SketchPoint {
	if (
		!Array.isArray(value) ||
		value.length !== 2 ||
		!isFiniteNumber(value[0]) ||
		!isFiniteNumber(value[1])
	) {
		throw new Error(`${fieldName} must be a [x, y] point`);
	}
	return [value[0], value[1]];
}

function normalizeNumber(value: number): number {
	return Number(value.toFixed(2));
}

function normalizePoint(point: SketchPoint): SketchPoint {
	return [normalizeNumber(point[0]), normalizeNumber(point[1])];
}

function validateBaseElement(input: Record<string, unknown>): BaseElement {
	return {
		id: optionalString(input.id, "element.id"),
		color: optionalString(input.color, "element.color"),
		opacity: optionalNumber(input.opacity, "element.opacity"),
	};
}

function validateElement(input: unknown, index: number): SketchElement {
	if (!isRecord(input)) {
		throw new Error(`elements[${index}] must be an object`);
	}

	if (typeof input.type !== "string") {
		throw new Error(`elements[${index}].type must be a string`);
	}

	const base = validateBaseElement(input);
	const prefix = `elements[${index}]`;

	switch (input.type) {
		case "stroke":
		case "highlight": {
			if (!Array.isArray(input.points)) {
				throw new Error(`${prefix}.points must be an array`);
			}
			return {
				...base,
				type: input.type,
				points: input.points.map((point, pointIndex) =>
					validatePoint(point, `${prefix}.points[${pointIndex}]`),
				),
				size: optionalNumber(input.size, `${prefix}.size`),
			};
		}
		case "line":
		case "arrow":
			return {
				...base,
				type: input.type,
				x1: requiredNumber(input.x1, `${prefix}.x1`),
				y1: requiredNumber(input.y1, `${prefix}.y1`),
				x2: requiredNumber(input.x2, `${prefix}.x2`),
				y2: requiredNumber(input.y2, `${prefix}.y2`),
				size: optionalNumber(input.size, `${prefix}.size`),
			};
		case "rect":
		case "ellipse":
			return {
				...base,
				type: input.type,
				x: requiredNumber(input.x, `${prefix}.x`),
				y: requiredNumber(input.y, `${prefix}.y`),
				width: requiredNumber(input.width, `${prefix}.width`),
				height: requiredNumber(input.height, `${prefix}.height`),
				stroke: optionalString(input.stroke, `${prefix}.stroke`),
				fill: optionalString(input.fill, `${prefix}.fill`),
				size: optionalNumber(input.size, `${prefix}.size`),
			};
		case "text":
			return {
				...base,
				type: "text",
				x: requiredNumber(input.x, `${prefix}.x`),
				y: requiredNumber(input.y, `${prefix}.y`),
				text: optionalString(input.text, `${prefix}.text`) ?? "",
				size: optionalNumber(input.size, `${prefix}.size`),
				font: optionalString(input.font, `${prefix}.font`),
			};
		default:
			throw new Error(`${prefix}.type "${input.type}" is not supported`);
	}
}

export function validateSketch(input: unknown): SketchDocument {
	if (!isRecord(input)) {
		throw new Error("Sketch document must be an object");
	}
	if (input.version !== 1) {
		throw new Error("Sketch document version must be 1");
	}
	if (!Array.isArray(input.elements)) {
		throw new Error("Sketch document elements must be an array");
	}

	return normalizeSketch({
		version: 1,
		width: requiredNumber(input.width, "width"),
		height: requiredNumber(input.height, "height"),
		background: optionalString(input.background, "background"),
		elements: input.elements.map(validateElement),
	});
}

function normalizeElement(element: SketchElement): SketchElement {
	switch (element.type) {
		case "stroke":
			return {
				id: element.id,
				type: "stroke",
				color: element.color ?? DEFAULT_STROKE_COLOR,
				opacity: element.opacity ?? 1,
				size: normalizeNumber(element.size ?? DEFAULT_STROKE_SIZE),
				points: element.points.map(normalizePoint),
			};
		case "highlight":
			return {
				id: element.id,
				type: "highlight",
				color: element.color ?? DEFAULT_HIGHLIGHT_COLOR,
				opacity: element.opacity ?? 0.35,
				size: normalizeNumber(element.size ?? 18),
				points: element.points.map(normalizePoint),
			};
		case "line":
		case "arrow":
			return {
				id: element.id,
				type: element.type,
				color: element.color ?? DEFAULT_STROKE_COLOR,
				opacity: element.opacity ?? 1,
				size: normalizeNumber(element.size ?? DEFAULT_STROKE_SIZE),
				x1: normalizeNumber(element.x1),
				y1: normalizeNumber(element.y1),
				x2: normalizeNumber(element.x2),
				y2: normalizeNumber(element.y2),
			};
		case "rect":
		case "ellipse":
			return {
				id: element.id,
				type: element.type,
				color: element.color,
				opacity: element.opacity ?? 1,
				stroke: element.stroke ?? element.color ?? DEFAULT_STROKE_COLOR,
				fill: element.fill ?? "transparent",
				size: normalizeNumber(element.size ?? DEFAULT_STROKE_SIZE),
				x: normalizeNumber(element.x),
				y: normalizeNumber(element.y),
				width: normalizeNumber(element.width),
				height: normalizeNumber(element.height),
			};
		case "text":
			return {
				id: element.id,
				type: "text",
				color: element.color ?? DEFAULT_STROKE_COLOR,
				opacity: element.opacity ?? 1,
				x: normalizeNumber(element.x),
				y: normalizeNumber(element.y),
				text: element.text,
				size: normalizeNumber(element.size ?? DEFAULT_TEXT_SIZE),
				font:
					element.font ??
					"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
			};
	}
}

export function normalizeSketch(document: SketchDocument): SketchDocument {
	return {
		version: 1,
		width: normalizeNumber(document.width),
		height: normalizeNumber(document.height),
		background: document.background,
		elements: document.elements.map(normalizeElement),
	};
}
