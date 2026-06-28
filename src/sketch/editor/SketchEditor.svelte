<script lang="ts">
import { onMount } from "svelte";
import type { SketchDocument, SketchElement, SketchPoint } from "../schema";
import { normalizeSketch, validateSketch } from "../schema";

export let embedded = false;
export let initialJson = "";
export let sourcePath = "";
export let onDocumentChange: ((document: SketchDocument) => void) | undefined =
	undefined;
export let onSaved:
	| ((result: { document: SketchDocument; imageUrl?: string }) => void)
	| undefined = undefined;

type Tool = "pen" | "highlight" | "eraser" | "pan";

const COLORS = [
	"#334155",
	"#7c3aed",
	"#dc2626",
	"#16a34a",
	"#2563eb",
	"#f59e0b",
];
const BRUSH_SIZES = [3, 5, 8, 14, 24];

let canvas: HTMLCanvasElement;
let fileInput: HTMLInputElement;
let tool: Tool = "pen";
let color = COLORS[0];
let size = 5;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isPointerDown = false;
let activeStroke: SketchPoint[] = [];
let lastPanPoint: SketchPoint | null = null;
let history: SketchDocument[] = [];
let future: SketchDocument[] = [];
let exportText = "";
let message = "";
let saving = false;
let renderFrame = 0;
let showAdvanced = false;

let document: SketchDocument = {
	version: 1,
	width: 1200,
	height: 700,
	background: "#ffffff",
	elements: [],
};

if (initialJson) {
	document = validateSketch(JSON.parse(initialJson));
}

$: exportText = JSON.stringify(normalizeSketch(document), null, 2);
$: onDocumentChange?.(normalizeSketch(document));

onMount(() => {
	scheduleRender();
});

function scheduleRender() {
	cancelAnimationFrame(renderFrame);
	renderFrame = requestAnimationFrame(() => {
		render();
	});
}

function pushHistory() {
	history = [...history, structuredClone(document)];
	future = [];
}

function getContext() {
	return canvas?.getContext("2d") ?? null;
}

function screenToDocument(event: PointerEvent): SketchPoint {
	const rect = canvas.getBoundingClientRect();
	return [
		(event.clientX - rect.left - offsetX) / zoom,
		(event.clientY - rect.top - offsetY) / zoom,
	];
}

function drawElement(
	context: CanvasRenderingContext2D,
	element: SketchElement,
) {
	context.save();
	context.lineCap = "round";
	context.lineJoin = "round";
	context.globalAlpha = element.opacity ?? 1;

	switch (element.type) {
		case "stroke":
		case "highlight": {
			context.strokeStyle = element.color ?? color;
			context.lineWidth = element.size ?? size;
			context.globalCompositeOperation =
				element.type === "highlight" ? "multiply" : "source-over";
			context.beginPath();
			element.points.forEach(([x, y], index) => {
				if (index === 0) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			});
			context.stroke();
			break;
		}
		case "line":
		case "arrow": {
			context.strokeStyle = element.color ?? color;
			context.lineWidth = element.size ?? size;
			context.beginPath();
			context.moveTo(element.x1, element.y1);
			context.lineTo(element.x2, element.y2);
			context.stroke();
			break;
		}
		case "rect":
			context.strokeStyle = element.stroke ?? element.color ?? color;
			context.fillStyle = element.fill ?? "transparent";
			context.lineWidth = element.size ?? size;
			context.fillRect(element.x, element.y, element.width, element.height);
			context.strokeRect(element.x, element.y, element.width, element.height);
			break;
		case "ellipse":
			context.strokeStyle = element.stroke ?? element.color ?? color;
			context.fillStyle = element.fill ?? "transparent";
			context.lineWidth = element.size ?? size;
			context.beginPath();
			context.ellipse(
				element.x + element.width / 2,
				element.y + element.height / 2,
				Math.abs(element.width / 2),
				Math.abs(element.height / 2),
				0,
				0,
				Math.PI * 2,
			);
			context.fill();
			context.stroke();
			break;
		case "text":
			context.fillStyle = element.color ?? color;
			context.font = `${element.size ?? 28}px ${element.font ?? "system-ui"}`;
			context.fillText(element.text, element.x, element.y);
			break;
	}

	context.restore();
}

function render() {
	const context = getContext();
	if (!context) {
		return;
	}

	const ratio = window.devicePixelRatio || 1;
	const clientWidth = canvas.clientWidth;
	const clientHeight = canvas.clientHeight;

	if (clientWidth === 0 || clientHeight === 0) {
		scheduleRender();
		return;
	}

	const width = clientWidth * ratio;
	const height = clientHeight * ratio;

	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}

	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, clientWidth, clientHeight);
	context.fillStyle = "#f8fafc";
	context.fillRect(0, 0, clientWidth, clientHeight);
	context.translate(offsetX, offsetY);
	context.scale(zoom, zoom);
	context.fillStyle = document.background ?? "#ffffff";
	context.fillRect(0, 0, document.width, document.height);
	context.strokeStyle = "#cbd5e1";
	context.lineWidth = 1;
	context.strokeRect(0, 0, document.width, document.height);

	for (const element of document.elements) {
		drawElement(context, element);
	}

	if (activeStroke.length > 0) {
		drawElement(context, {
			type: tool === "highlight" ? "highlight" : "stroke",
			color,
			opacity: tool === "highlight" ? 0.35 : 1,
			size: tool === "highlight" ? size * 3 : size,
			points: activeStroke,
		});
	}
}

function onPointerDown(event: PointerEvent) {
	canvas.setPointerCapture(event.pointerId);
	isPointerDown = true;

	if (tool === "pan") {
		lastPanPoint = [event.clientX, event.clientY];
		return;
	}

	pushHistory();
	activeStroke = [screenToDocument(event)];
}

function onPointerMove(event: PointerEvent) {
	if (!isPointerDown) {
		return;
	}

	if (tool === "pan" && lastPanPoint) {
		offsetX += event.clientX - lastPanPoint[0];
		offsetY += event.clientY - lastPanPoint[1];
		lastPanPoint = [event.clientX, event.clientY];
		render();
		return;
	}

	activeStroke = [...activeStroke, screenToDocument(event)];
	scheduleRender();
}

function onPointerUp() {
	isPointerDown = false;
	lastPanPoint = null;

	if (activeStroke.length === 0) {
		return;
	}

	if (tool === "eraser") {
		const [x, y] = activeStroke.at(-1) ?? activeStroke[0];
		document = {
			...document,
			elements: document.elements.filter((element) => {
				if (element.type !== "stroke" && element.type !== "highlight") {
					return true;
				}
				return !element.points.some(
					([pointX, pointY]) => Math.hypot(pointX - x, pointY - y) < size * 3,
				);
			}),
		};
	} else {
		document = {
			...document,
			elements: [
				...document.elements,
				{
					type: tool === "highlight" ? "highlight" : "stroke",
					color,
					opacity: tool === "highlight" ? 0.35 : 1,
					size: tool === "highlight" ? size * 3 : size,
					points: activeStroke,
				},
			],
		};
	}

	activeStroke = [];
	scheduleRender();
}

function undo() {
	const previous = history.at(-1);
	if (!previous) {
		return;
	}
	future = [structuredClone(document), ...future];
	history = history.slice(0, -1);
	document = previous;
	scheduleRender();
}

function redo() {
	const next = future[0];
	if (!next) {
		return;
	}
	history = [...history, structuredClone(document)];
	future = future.slice(1);
	document = next;
	scheduleRender();
}

function clearCanvas() {
	pushHistory();
	document = { ...document, elements: [] };
	scheduleRender();
}

function resetView() {
	zoom = 1;
	offsetX = 0;
	offsetY = 0;
	scheduleRender();
}

async function copyJson() {
	await navigator.clipboard.writeText(exportText);
	message = "Copied canvas data";
	setTimeout(() => {
		message = "";
	}, 1200);
}

function importJson() {
	const imported = validateSketch(JSON.parse(exportText));
	pushHistory();
	document = imported;
	message = "Imported canvas data";
	scheduleRender();
}

async function saveCanvas() {
	if (!sourcePath) {
		await copyJson();
		message =
			"Copied canvas data; inline sketches cannot be saved automatically";
		return;
	}

	saving = true;
	try {
		const response = await fetch("/__sketch/save", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				path: sourcePath,
				document: normalizeSketch(document),
			}),
		});
		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.error ?? "Failed to save canvas");
		}
		onSaved?.({
			document: normalizeSketch(document),
			imageUrl:
				typeof result.imageUrl === "string" ? result.imageUrl : undefined,
		});
		message = "Saved canvas";
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	} finally {
		saving = false;
	}
}

function openFilePicker() {
	fileInput.click();
}

async function loadFile(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) {
		return;
	}
	const text = await file.text();
	exportText = text;
	importJson();
	input.value = "";
}
</script>

<svelte:window on:resize={scheduleRender} />

<div class:embedded class="sketch-editor">
	<div class="toolbar">
		<div class="group">
			<button class:active={tool === "pen"} type="button" on:click={() => (tool = "pen")}>Pen</button>
			<button class:active={tool === "highlight"} type="button" on:click={() => (tool = "highlight")}>Highlighter</button>
			<button class:active={tool === "eraser"} type="button" on:click={() => (tool = "eraser")}>Eraser</button>
			<button class:active={tool === "pan"} type="button" on:click={() => (tool = "pan")}>Pan</button>
		</div>

		<div class="group">
			{#each COLORS as swatch}
				<button
					class:active={color === swatch}
					class="swatch"
					style={`--swatch: ${swatch}`}
					type="button"
					aria-label={`Use ${swatch}`}
					on:click={() => {
						color = swatch;
						scheduleRender();
					}}
				></button>
			{/each}
		</div>

		<div class="group">
			<label>
				Size
				<select bind:value={size} on:change={scheduleRender}>
					{#each BRUSH_SIZES as brushSize}
						<option value={brushSize}>{brushSize}px</option>
					{/each}
				</select>
			</label>
			<label>
				Zoom
				<input bind:value={zoom} max="3" min="0.3" step="0.1" type="range" on:input={scheduleRender} />
			</label>
		</div>

		<div class="group">
			<button type="button" on:click={undo}>Undo</button>
			<button type="button" on:click={redo}>Redo</button>
			<button type="button" on:click={resetView}>Reset View</button>
			<button type="button" on:click={clearCanvas}>Clear</button>
		</div>
	</div>

	<canvas
		bind:this={canvas}
		on:pointerdown={onPointerDown}
		on:pointermove={onPointerMove}
		on:pointerup={onPointerUp}
		on:pointercancel={onPointerUp}
	></canvas>

	<div class="statusbar">
		<button class="primary-action" type="button" disabled={saving} on:click={saveCanvas}>
			{sourcePath ? "Save Canvas" : "Copy Canvas Data"}
		</button>
		<button type="button" on:click={() => (showAdvanced = !showAdvanced)}>
			{showAdvanced ? "Hide Advanced" : "Advanced"}
		</button>
		<span aria-live="polite">{message}</span>
	</div>

	{#if showAdvanced}
		<div class="io">
			<div class="io-actions">
				<button type="button" on:click={copyJson}>Copy Data</button>
				<button type="button" on:click={importJson}>Import Data</button>
				<button type="button" on:click={openFilePicker}>Open File</button>
			</div>
			<input bind:this={fileInput} accept=".json,.sketch.json,application/json" hidden type="file" on:change={loadFile} />
			<textarea bind:value={exportText} spellcheck="false" aria-label="Canvas data"></textarea>
		</div>
	{/if}
</div>

<style>
	.sketch-editor {
		display: grid;
		gap: 1rem;
		min-height: 100vh;
		padding: 1rem;
		background: #e2e8f0;
		color: #0f172a;
	}

	.sketch-editor.embedded {
		min-height: 0;
		margin-top: 1rem;
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
	}

	.toolbar,
	.io-actions,
	.statusbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.group {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		padding: 0.4rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: #ffffff;
	}

	button,
	select {
		min-height: 2rem;
		border: 1px solid #94a3b8;
		border-radius: 6px;
		background: #ffffff;
		color: #0f172a;
		font: inherit;
	}

	button {
		padding: 0 0.75rem;
		cursor: pointer;
	}

	button.active {
		border-color: #7c3aed;
		background: #ede9fe;
	}

	button.primary-action {
		border-color: #7c3aed;
		background: #7c3aed;
		color: #ffffff;
		font-weight: 700;
	}

	.swatch {
		width: 2rem;
		padding: 0;
		background: var(--swatch);
	}

	label {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
	}

	canvas {
		width: 100%;
		height: min(62vh, 720px);
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #f8fafc;
		touch-action: none;
	}

	.sketch-editor.embedded canvas {
		height: min(58vh, 680px);
	}

	.io {
		display: grid;
		gap: 0.75rem;
	}

	textarea {
		width: 100%;
		min-height: 14rem;
		padding: 0.75rem;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}
</style>
