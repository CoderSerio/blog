import sharp from "sharp";
import type { SketchDocument } from "./schema";
import { renderSketchToSvg } from "./svg";

export type RenderImageFormat = "webp" | "png";

export type RenderOptions = {
	format?: RenderImageFormat;
	scale?: number;
	quality?: number;
};

export type RenderResult = {
	buffer: Buffer;
	format: RenderImageFormat;
	width: number;
	height: number;
	scale: number;
};

const DEFAULT_OPTIONS: Required<RenderOptions> = {
	format: "webp",
	scale: 2,
	quality: 86,
};

export async function renderSketchToImage(
	document: SketchDocument,
	options: RenderOptions = {},
): Promise<RenderResult> {
	const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
	const svg = renderSketchToSvg(document);
	const density = 72 * mergedOptions.scale;
	const image = sharp(Buffer.from(svg), { density });
	const buffer =
		mergedOptions.format === "png"
			? await image.png().toBuffer()
			: await image.webp({ quality: mergedOptions.quality }).toBuffer();

	return {
		buffer,
		format: mergedOptions.format,
		width: document.width,
		height: document.height,
		scale: mergedOptions.scale,
	};
}
