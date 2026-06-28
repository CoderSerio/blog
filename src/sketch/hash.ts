import { createHash } from "node:crypto";
import path from "node:path";
import type { SketchDocument } from "./schema";

export const SKETCH_RENDERER_VERSION = "1";

export type SketchAssetNameOptions = {
	format: "webp" | "png";
	hash?: string;
	mode?: "development" | "production";
	root?: string;
	sourcePath?: string;
};

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortValue);
	}
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entryValue]) => entryValue !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entryValue]) => [key, sortValue(entryValue)]),
		);
	}
	return value;
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

export function hashSketch(document: SketchDocument): string {
	return createHash("sha256")
		.update(SKETCH_RENDERER_VERSION)
		.update("\n")
		.update(stableStringify(document))
		.digest("hex")
		.slice(0, 12);
}

function sanitizeAssetLabel(value: string): string {
	return (
		value
			.replace(/\.[^.]+$/g, "")
			.replace(/[^a-zA-Z0-9_-]+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase() || "sketch"
	);
}

function getSourceLabel(sourcePath: string, root: string): string {
	const relativePath = path.relative(root, sourcePath);
	const label =
		relativePath &&
		!relativePath.startsWith("..") &&
		!path.isAbsolute(relativePath)
			? relativePath
			: path.basename(sourcePath);

	return label.replace(/\.sketch\.json$/g, "");
}

export function getSketchAssetBasename(
	label: string,
	options: SketchAssetNameOptions,
): string {
	if (options.mode === "development" && options.sourcePath) {
		const sourceLabel = getSourceLabel(
			options.sourcePath,
			options.root ?? process.cwd(),
		);
		return `${sanitizeAssetLabel(sourceLabel)}.dev.${options.format}`;
	}

	const hash = options.hash ?? sanitizeAssetLabel(SKETCH_RENDERER_VERSION);
	return `${sanitizeAssetLabel(label)}.${hash}.${options.format}`;
}
