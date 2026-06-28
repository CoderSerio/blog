import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visit } from "unist-util-visit";
import { getSketchAssetBasename, hashSketch } from "./hash";
import { type RenderImageFormat, renderSketchToImage } from "./render";
import { validateSketch } from "./schema";

export type RemarkSketchOptions = {
	outputDir?: string;
	publicPath?: string;
	format?: RenderImageFormat;
	scale?: number;
	quality?: number;
	mode?: "development" | "production";
};

type MarkdownNode = {
	type: string;
	lang?: string;
	value?: string;
	name?: string;
	attributes?: Record<string, unknown>;
	children?: MarkdownNode[];
	data?: Record<string, unknown>;
};

type VFileLike = {
	path?: string;
	history?: string[];
};

type RemarkTransformer = (tree: MarkdownNode, file: VFileLike) => Promise<void>;

const DEFAULT_OUTPUT_DIR = "public/generated/sketch";
const DEFAULT_PUBLIC_PATH = "/generated/sketch";

function parseJson(source: string, label: string): unknown {
	try {
		return JSON.parse(source);
	} catch (error) {
		throw new Error(
			`Failed to parse sketch JSON in ${label}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

function getVFilePath(file: VFileLike): string | undefined {
	return file.path ?? file.history?.[0];
}

function getCurrentDirectory(file: VFileLike): string {
	const currentPath = getVFilePath(file);
	if (!currentPath) {
		return process.cwd();
	}
	return path.dirname(currentPath);
}

function getAttribute(
	attributes: Record<string, unknown> | undefined,
	name: string,
): string | undefined {
	const value = attributes?.[name];
	return typeof value === "string" ? value : undefined;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

async function readSketchSource(src: string, file: VFileLike): Promise<string> {
	const baseDirectory = getCurrentDirectory(file);
	const resolvedPath = path.isAbsolute(src)
		? src
		: path.resolve(baseDirectory, src);

	return readFile(resolvedPath, "utf8");
}

function resolveSketchPath(src: string, file: VFileLike): string {
	const baseDirectory = getCurrentDirectory(file);
	return path.isAbsolute(src) ? src : path.resolve(baseDirectory, src);
}

async function renderSketchAsset(
	source: string,
	label: string,
	options: Required<RemarkSketchOptions>,
	alt = "",
	sourcePath?: string,
): Promise<{ html: string; documentWidth: number; documentHeight: number }> {
	const document = validateSketch(parseJson(source, label));
	const hash = hashSketch(document);
	const basename = getSketchAssetBasename(label, {
		format: options.format,
		hash,
		mode: options.mode,
		root: process.cwd(),
		sourcePath,
	});
	const outputPath = path.join(options.outputDir, basename);
	const publicPath = `${options.publicPath.replace(/\/$/g, "")}/${basename}`;
	const result = await renderSketchToImage(document, {
		format: options.format,
		scale: options.scale,
		quality: options.quality,
	});

	await mkdir(options.outputDir, { recursive: true });
	await writeFile(outputPath, new Uint8Array(result.buffer));

	const imageHtml = `<img src="${escapeHtml(publicPath)}" width="${result.width}" height="${result.height}" loading="lazy" decoding="async" alt="${escapeHtml(alt)}" />`;
	const pathAttribute = sourcePath
		? ` data-sketch-path="${escapeHtml(sourcePath)}"`
		: "";
	const outputAttribute =
		options.mode === "development"
			? ` data-sketch-output-url="${escapeHtml(publicPath)}"`
			: "";
	const html =
		options.mode === "development"
			? `<figure class="sketch-image-frame sketch-dev-frame" data-pagefind-ignore data-sketch-source="${escapeHtml(source)}"${pathAttribute}${outputAttribute}>${imageHtml}<button class="sketch-edit-button" type="button">Edit sketch</button><div class="sketch-dev-modal" hidden><div class="sketch-dev-dialog" role="dialog" aria-modal="true" aria-label="Sketch editor"><button class="sketch-dev-close" type="button" aria-label="Close sketch editor">Close</button><div class="sketch-dev-editor"></div></div></div></figure>`
			: `<figure class="sketch-image-frame" data-pagefind-ignore>${imageHtml}</figure>`;

	return {
		documentWidth: result.width,
		documentHeight: result.height,
		html,
	};
}

async function transformCodeNode(
	node: MarkdownNode,
	index: number,
	options: Required<RemarkSketchOptions>,
): Promise<void> {
	const label = `inline-sketch-${index}`;
	const rendered = await renderSketchAsset(node.value ?? "", label, options);
	node.type = "html";
	node.value = rendered.html;
	delete node.lang;
}

async function transformDirectiveNode(
	node: MarkdownNode,
	file: VFileLike,
	options: Required<RemarkSketchOptions>,
): Promise<void> {
	const src = getAttribute(node.attributes, "src");
	if (!src) {
		throw new Error("Sketch directive requires a string src attribute");
	}

	const alt = getAttribute(node.attributes, "alt") ?? "";
	const source = await readSketchSource(src, file);
	const sourcePath = resolveSketchPath(src, file);
	const rendered = await renderSketchAsset(
		source,
		path.basename(src),
		options,
		alt,
		sourcePath,
	);
	node.type = "html";
	node.value = rendered.html;
	delete node.name;
	delete node.attributes;
	delete node.children;
	delete node.data;
}

export function remarkSketchImage(
	options: RemarkSketchOptions = {},
): RemarkTransformer {
	const cwd = process.cwd();
	const outputDir =
		options.outputDir ??
		path.resolve(
			cwd,
			fileURLToPath(new URL("../../public/generated/sketch", import.meta.url)),
		);
	const pluginOptions: Required<RemarkSketchOptions> = {
		outputDir,
		publicPath: options.publicPath ?? DEFAULT_PUBLIC_PATH,
		format: options.format ?? "webp",
		scale: options.scale ?? 2,
		quality: options.quality ?? 86,
		mode:
			options.mode ??
			(process.env.NODE_ENV === "production" ? "production" : "development"),
	};

	if (!path.isAbsolute(pluginOptions.outputDir)) {
		pluginOptions.outputDir = path.resolve(cwd, pluginOptions.outputDir);
	}

	return async (tree: MarkdownNode, file: VFileLike) => {
		const transforms: Promise<void>[] = [];
		let inlineIndex = 0;

		visit(tree, (node: MarkdownNode) => {
			if (node.type === "code" && node.lang === "sketch") {
				inlineIndex += 1;
				transforms.push(transformCodeNode(node, inlineIndex, pluginOptions));
				return;
			}

			if (
				(node.type === "leafDirective" || node.type === "containerDirective") &&
				node.name === "sketch"
			) {
				transforms.push(transformDirectiveNode(node, file, pluginOptions));
			}
		});

		await Promise.all(transforms);
	};
}

export { DEFAULT_OUTPUT_DIR, DEFAULT_PUBLIC_PATH };
