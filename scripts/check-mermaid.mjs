import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const postsDirectory = path.resolve("src/content/posts");
const mermaidFence = /^```mermaid[^\n]*\r?\n([\s\S]*?)^```\s*$/gm;

// Mermaid's Node entry loads DOMPurify without a browser Window. Flowchart
// parsing still calls its hooks, so provide the two no-op methods required for
// grammar validation. This script never renders or publishes the source.
const require = createRequire(import.meta.url);
const mermaidPackage = require.resolve("mermaid/package.json");
const domPurifyCommonJs = require.resolve("dompurify", {
	paths: [mermaidPackage],
});
const domPurifyModule = pathToFileURL(
	path.join(path.dirname(domPurifyCommonJs), "purify.es.mjs"),
).href;
const { default: domPurify } = await import(domPurifyModule);
domPurify.addHook = () => {};
domPurify.sanitize = (value) => value;

const { default: mermaid } = await import("mermaid");

async function collectMarkdownFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return collectMarkdownFiles(absolutePath);
			}
			return entry.isFile() && entry.name.endsWith(".md") ? [absolutePath] : [];
		}),
	);
	return files.flat();
}

const requestedFiles = process.argv.slice(2);
const files =
	requestedFiles.length > 0
		? requestedFiles.map((file) => path.resolve(file))
		: await collectMarkdownFiles(postsDirectory);
const failures = [];
let diagramCount = 0;

for (const file of files) {
	const markdown = await readFile(file, "utf8");
	let index = 0;

	for (const match of markdown.matchAll(mermaidFence)) {
		index += 1;
		diagramCount += 1;
		try {
			await mermaid.parse(match[1]);
		} catch (error) {
			failures.push({
				file: path.relative(process.cwd(), file),
				index,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

if (failures.length > 0) {
	console.error(`Mermaid validation failed for ${failures.length} diagram(s):`);
	for (const failure of failures) {
		console.error(`\n${failure.file} · diagram ${failure.index}`);
		console.error(failure.message);
	}
	process.exitCode = 1;
} else {
	console.log(
		`Validated ${diagramCount} Mermaid diagrams in ${files.length} posts.`,
	);
}
