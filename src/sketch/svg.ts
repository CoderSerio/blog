import type {
	SketchDocument,
	SketchElement,
	SketchLineElement,
	SketchPoint,
	SketchShapeElement,
	SketchStrokeElement,
	SketchTextElement,
} from "./schema";

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function pointsToPath(points: SketchPoint[]): string {
	if (points.length === 0) {
		return "";
	}
	if (points.length === 1) {
		const [x, y] = points[0];
		return `M ${x} ${y} L ${x + 0.01} ${y + 0.01}`;
	}

	return points
		.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
		.join(" ");
}

function lineAttributes(
	element: SketchStrokeElement | SketchLineElement,
): string {
	const color = element.color ?? "#334155";
	const opacity = element.opacity ?? 1;
	const size = element.size ?? 4;

	return `stroke="${escapeXml(color)}" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"`;
}

function renderStroke(element: SketchStrokeElement): string {
	const path = pointsToPath(element.points);
	if (path.length === 0) {
		return "";
	}

	if (element.type === "erase") {
		return `<path d="${path}" fill="none" stroke="#000000" stroke-width="${element.size ?? 24}" stroke-linecap="round" stroke-linejoin="round" />`;
	}

	return `<path d="${path}" fill="none" ${lineAttributes(element)} />`;
}

function renderLine(element: SketchLineElement): string {
	const line = `<line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" ${lineAttributes(element)} />`;

	if (element.type === "line") {
		return line;
	}

	const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
	const headSize = Math.max((element.size ?? 4) * 4, 12);
	const leftX = element.x2 - headSize * Math.cos(angle - Math.PI / 6);
	const leftY = element.y2 - headSize * Math.sin(angle - Math.PI / 6);
	const rightX = element.x2 - headSize * Math.cos(angle + Math.PI / 6);
	const rightY = element.y2 - headSize * Math.sin(angle + Math.PI / 6);

	return `${line}<path d="M ${leftX} ${leftY} L ${element.x2} ${element.y2} L ${rightX} ${rightY}" fill="none" ${lineAttributes(element)} />`;
}

function renderShape(element: SketchShapeElement): string {
	const stroke = escapeXml(element.stroke ?? element.color ?? "#334155");
	const fill = escapeXml(element.fill ?? "transparent");
	const opacity = element.opacity ?? 1;
	const size = element.size ?? 4;
	const common = `stroke="${stroke}" stroke-width="${size}" fill="${fill}" opacity="${opacity}"`;

	if (element.type === "rect") {
		return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" ry="8" ${common} />`;
	}

	return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${Math.abs(element.width / 2)}" ry="${Math.abs(element.height / 2)}" ${common} />`;
}

function renderText(element: SketchTextElement): string {
	const color = escapeXml(element.color ?? "#334155");
	const opacity = element.opacity ?? 1;
	const size = element.size ?? 28;
	const font = escapeXml(
		element.font ?? "ui-sans-serif, system-ui, sans-serif",
	);

	return `<text x="${element.x}" y="${element.y}" fill="${color}" opacity="${opacity}" font-size="${size}" font-family="${font}" dominant-baseline="text-before-edge">${escapeXml(element.text)}</text>`;
}

function renderElement(element: SketchElement): string {
	switch (element.type) {
		case "stroke":
		case "highlight":
		case "erase":
			return renderStroke(element);
		case "line":
		case "arrow":
			return renderLine(element);
		case "rect":
		case "ellipse":
			return renderShape(element);
		case "text":
			return renderText(element);
	}
}

export function renderSketchToSvg(document: SketchDocument): string {
	const background =
		document.background && document.background !== "transparent"
			? `<rect width="100%" height="100%" fill="${escapeXml(document.background)}" />`
			: "";
	const maskId = "sketch-visible-mask";
	const visibleElements = document.elements
		.filter((element) => element.type !== "erase")
		.map(renderElement)
		.join("");
	const eraseElements = document.elements
		.filter((element) => element.type === "erase")
		.map(renderElement)
		.join("");

	if (!eraseElements) {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}" role="img">${background}${visibleElements}</svg>`;
	}

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}" role="img"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white" />${eraseElements}</mask></defs>${background}<g mask="url(#${maskId})">${visibleElements}</g></svg>`;
}
