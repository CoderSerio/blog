import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { getSketchAssetBasename } from "./hash";
import { renderSketchToImage } from "./render";
import { type SketchDocument, validateSketch } from "./schema";

type SaveRequest = {
	path?: unknown;
	document?: unknown;
};

const SAVE_ENDPOINT = "/__sketch/save";
const DOCUMENT_ENDPOINT = "/__sketch/document";
const sketchDocuments = new Map<string, SketchDocument>();

type SketchDevServerPlugin = {
	name: string;
	apply: "serve";
	configureServer(server: {
		config: { root: string };
		middlewares: {
			use(
				path: string,
				handler: (
					request: IncomingMessage,
					response: ServerResponse,
				) => void | Promise<void>,
			): void;
		};
	}): void;
};

function readRequestBody(request: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk: string) => {
			body += chunk;
		});
		request.on("end", () => resolve(body));
		request.on("error", reject);
	});
}

function sendJson(
	response: ServerResponse,
	statusCode: number,
	payload: unknown,
) {
	response.statusCode = statusCode;
	response.setHeader("content-type", "application/json; charset=utf-8");
	response.end(JSON.stringify(payload));
}

function getRequestPath(request: IncomingMessage): string | undefined {
	const url = new URL(request.url ?? "", "http://localhost");
	return url.searchParams.get("path") ?? undefined;
}

function isWritableSketchPath(root: string, targetPath: string): boolean {
	const resolvedRoot = path.resolve(root);
	const resolvedPath = path.resolve(targetPath);
	const sketchesRoot = path.join(resolvedRoot, "src/assets/sketches");
	const relative = path.relative(resolvedRoot, resolvedPath);
	const sketchRelative = path.relative(sketchesRoot, resolvedPath);

	return (
		relative.length > 0 &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative) &&
		sketchRelative.length > 0 &&
		!sketchRelative.startsWith("..") &&
		!path.isAbsolute(sketchRelative) &&
		resolvedPath.endsWith(".sketch.json")
	);
}

function getSketchImagePaths(root: string, sourcePath: string) {
	const basename = getSketchAssetBasename(path.basename(sourcePath), {
		format: "webp",
		mode: "development",
		root,
		sourcePath,
	});
	const outputDir = path.join(root, "public/generated/sketch");

	return {
		outputDir,
		outputPath: path.join(outputDir, basename),
		publicPath: `/generated/sketch/${basename}`,
	};
}

async function writeSketchImage(
	root: string,
	sourcePath: string,
	document: SketchDocument,
) {
	const imagePaths = getSketchImagePaths(root, sourcePath);
	const image = await renderSketchToImage(document, {
		format: "webp",
		scale: 2,
		quality: 86,
	});
	await mkdir(imagePaths.outputDir, { recursive: true });
	await writeFile(imagePaths.outputPath, new Uint8Array(image.buffer));

	return `${imagePaths.publicPath}?t=${Date.now()}`;
}

async function readSketchDocument(sourcePath: string): Promise<SketchDocument> {
	const resolvedPath = path.resolve(sourcePath);
	const cachedDocument = sketchDocuments.get(resolvedPath);
	if (cachedDocument) {
		return cachedDocument;
	}

	const document = validateSketch(
		JSON.parse(await readFile(resolvedPath, "utf8")),
	);
	sketchDocuments.set(resolvedPath, document);
	return document;
}

export function sketchDevServer(): SketchDevServerPlugin {
	return {
		name: "sketch-dev-server",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use(DOCUMENT_ENDPOINT, async (request, response) => {
				if (request.method !== "GET") {
					sendJson(response, 405, { error: "Method not allowed" });
					return;
				}

				try {
					const sourcePath = getRequestPath(request);
					if (typeof sourcePath !== "string") {
						sendJson(response, 400, { error: "Missing sketch path" });
						return;
					}
					if (!isWritableSketchPath(server.config.root, sourcePath)) {
						sendJson(response, 403, {
							error:
								"Sketch path must be under src/assets/sketches and end with .sketch.json",
						});
						return;
					}

					const document = await readSketchDocument(sourcePath);
					const imageUrl = await writeSketchImage(
						server.config.root,
						sourcePath,
						document,
					);
					sendJson(response, 200, { ok: true, document, imageUrl });
				} catch (error) {
					sendJson(response, 400, {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			});

			server.middlewares.use(SAVE_ENDPOINT, async (request, response) => {
				if (request.method !== "POST") {
					sendJson(response, 405, { error: "Method not allowed" });
					return;
				}

				try {
					const payload = JSON.parse(
						await readRequestBody(request),
					) as SaveRequest;
					if (typeof payload.path !== "string") {
						sendJson(response, 400, { error: "Missing sketch path" });
						return;
					}
					if (!isWritableSketchPath(server.config.root, payload.path)) {
						sendJson(response, 403, {
							error:
								"Sketch path must be under src/assets/sketches and end with .sketch.json",
						});
						return;
					}

					const document = validateSketch(payload.document);
					const resolvedPath = path.resolve(payload.path);
					sketchDocuments.set(resolvedPath, document);
					await writeFile(
						resolvedPath,
						`${JSON.stringify(document, null, "\t")}\n`,
					);
					const imageUrl = await writeSketchImage(
						server.config.root,
						resolvedPath,
						document,
					);
					sendJson(response, 200, { ok: true, document, imageUrl });
				} catch (error) {
					sendJson(response, 400, {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			});
		},
	};
}
