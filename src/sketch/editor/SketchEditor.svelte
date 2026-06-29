<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type { SketchDocument, SketchElement, SketchPoint } from "../schema";
import { normalizeSketch, validateSketch } from "../schema";
import { SHORTCUTS, TOOL_OPTIONS, type Tool, ZOOM_ICON } from "./constants";

export let embedded = false;
export let initialJson = "";
export let sourcePath = "";
export let onDocumentChange: ((document: SketchDocument) => void) | undefined =
	undefined;
export let onSaved:
	| ((result: { document: SketchDocument; imageUrl?: string }) => void)
	| undefined = undefined;
export let onDirtyChange: ((dirty: boolean) => void) | undefined = undefined;

const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 64;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

let canvas: HTMLCanvasElement;
let fileInput: HTMLInputElement;
let colorInput: HTMLInputElement;
let colorButton: HTMLButtonElement;
let tool: Tool = "pen";
let color = "#334155";
let previousColor = "#7c3aed";
let size = 5;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isPointerDown = false;
let activeStroke: SketchPoint[] = [];
let lastPanPoint: SketchPoint | null = null;
let pointerPreview: {
	x: number;
	y: number;
} | null = null;
let history: SketchDocument[] = [];
let future: SketchDocument[] = [];
let exportText = "";
let currentSnapshot = "";
let savedSnapshot = "";
let message = "";
let saving = false;
let renderFrame = 0;
let showAdvanced = false;
let isDirty = false;
let lastReportedDirty = false;
let debugPanelHeight = 260;
let isResizingDebugPanel = false;

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

savedSnapshot = getDocumentSnapshot(document);

$: currentSnapshot = getDocumentSnapshot(document);
$: exportText = JSON.stringify(normalizeSketch(document), null, 2);
$: isDirty = currentSnapshot !== savedSnapshot;
$: if (isDirty !== lastReportedDirty) {
	lastReportedDirty = isDirty;
	onDirtyChange?.(isDirty);
}
$: onDocumentChange?.(normalizeSketch(document));

onMount(() => {
	requestAnimationFrame(() => {
		fitView();
	});
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

function getDocumentSnapshot(document: SketchDocument): string {
	return JSON.stringify(normalizeSketch(document));
}

function screenToDocument(event: PointerEvent): SketchPoint {
	const rect = canvas.getBoundingClientRect();
	return [
		(event.clientX - rect.left - offsetX) / zoom,
		(event.clientY - rect.top - offsetY) / zoom,
	];
}

function updatePointerPreview(event: PointerEvent) {
	const rect = canvas.getBoundingClientRect();
	pointerPreview = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function getActiveBrushSize() {
	return tool === "eraser" || tool === "highlight" ? size * 3 : size;
}

function getCurrentToolIcon() {
	return (
		TOOL_OPTIONS.find((option) => option.tool === tool)?.icon ??
		"material-symbols:brush-outline-rounded"
	);
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
		case "erase": {
			context.globalCompositeOperation = "destination-out";
			context.strokeStyle = "#000000";
			context.lineWidth = element.size ?? size;
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
	context.save();
	context.translate(offsetX, offsetY);
	context.scale(zoom, zoom);
	context.fillStyle = document.background ?? "#ffffff";
	context.fillRect(0, 0, document.width, document.height);
	context.restore();

	const inkLayer = window.document.createElement("canvas");
	inkLayer.width = width;
	inkLayer.height = height;
	const inkContext = inkLayer.getContext("2d");
	if (!inkContext) {
		return;
	}

	inkContext.setTransform(ratio, 0, 0, ratio, 0, 0);
	inkContext.translate(offsetX, offsetY);
	inkContext.scale(zoom, zoom);
	inkContext.beginPath();
	inkContext.rect(0, 0, document.width, document.height);
	inkContext.clip();

	for (const element of document.elements) {
		drawElement(inkContext, element);
	}

	if (activeStroke.length > 0) {
		drawElement(inkContext, {
			type:
				tool === "eraser"
					? "erase"
					: tool === "highlight"
						? "highlight"
						: "stroke",
			color,
			opacity: tool === "highlight" ? 0.35 : 1,
			size:
				tool === "eraser" ? size * 3 : tool === "highlight" ? size * 3 : size,
			points: activeStroke,
		});
	}

	context.drawImage(inkLayer, 0, 0, clientWidth, clientHeight);
	context.save();
	context.translate(offsetX, offsetY);
	context.scale(zoom, zoom);
	context.strokeStyle = "#cbd5e1";
	context.lineWidth = 1;
	context.strokeRect(0, 0, document.width, document.height);
	context.restore();
}

function onPointerDown(event: PointerEvent) {
	canvas.setPointerCapture(event.pointerId);
	isPointerDown = true;
	updatePointerPreview(event);

	if (tool === "pan") {
		lastPanPoint = [event.clientX, event.clientY];
		return;
	}

	pushHistory();
	activeStroke = [screenToDocument(event)];
}

function onPointerMove(event: PointerEvent) {
	updatePointerPreview(event);

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

	document = {
		...document,
		elements: [
			...document.elements,
			{
				type:
					tool === "eraser"
						? "erase"
						: tool === "highlight"
							? "highlight"
							: "stroke",
				color,
				opacity: tool === "highlight" ? 0.35 : 1,
				size:
					tool === "eraser" ? size * 3 : tool === "highlight" ? size * 3 : size,
				points: activeStroke,
			},
		],
	};

	activeStroke = [];
	scheduleRender();
}

function onPointerLeave() {
	if (!isPointerDown) {
		pointerPreview = null;
	}
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

function setBrushSize(nextSize: number) {
	if (!Number.isFinite(nextSize)) {
		return;
	}
	size = Math.min(
		MAX_BRUSH_SIZE,
		Math.max(MIN_BRUSH_SIZE, Math.round(nextSize)),
	);
	scheduleRender();
}

function setZoom(nextZoom: number) {
	if (!Number.isFinite(nextZoom)) {
		return;
	}
	const canvasCenter: SketchPoint = [
		canvas.clientWidth / 2,
		canvas.clientHeight / 2,
	];
	const documentCenter: SketchPoint = [
		(canvasCenter[0] - offsetX) / zoom,
		(canvasCenter[1] - offsetY) / zoom,
	];
	zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom.toFixed(2))));
	offsetX = canvasCenter[0] - documentCenter[0] * zoom;
	offsetY = canvasCenter[1] - documentCenter[1] * zoom;
	scheduleRender();
}

function setZoomPercent(nextPercent: number) {
	if (!Number.isFinite(nextPercent)) {
		return;
	}
	setZoom(nextPercent / 100);
}

function zoomIn() {
	setZoom(zoom + 0.1);
}

function zoomOut() {
	setZoom(zoom - 0.1);
}

function increaseBrushSize() {
	setBrushSize(size + 1);
}

function decreaseBrushSize() {
	setBrushSize(size - 1);
}

function zoomByWheel(event: WheelEvent) {
	if (!event.ctrlKey) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
}

function resizeDebugPanel(event: PointerEvent) {
	if (!isResizingDebugPanel) {
		return;
	}
	debugPanelHeight = Math.min(
		560,
		Math.max(120, window.innerHeight - event.clientY),
	);
}

function stopResizingDebugPanel() {
	isResizingDebugPanel = false;
}

function startResizingDebugPanel(event: PointerEvent) {
	isResizingDebugPanel = true;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	resizeDebugPanel(event);
}

function setColor(nextColor: string) {
	if (nextColor === color) {
		return;
	}
	previousColor = color;
	color = nextColor;
	scheduleRender();
}

function clearCanvas() {
	pushHistory();
	document = { ...document, elements: [] };
	scheduleRender();
}

function resetView() {
	fitView();
}

function fitView() {
	if (!canvas) {
		return;
	}

	const padding = 40;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (width === 0 || height === 0) {
		scheduleRender();
		return;
	}

	zoom = Math.min(
		1,
		Math.max(
			0.2,
			Math.min(
				(width - padding * 2) / document.width,
				(height - padding * 2) / document.height,
			),
		),
	);
	offsetX = (width - document.width * zoom) / 2;
	offsetY = (height - document.height * zoom) / 2;
	scheduleRender();
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
}

function onKeydown(event: KeyboardEvent) {
	const key = event.key.toLowerCase();
	const hasOnlyCtrl = event.ctrlKey && !event.metaKey && !event.altKey;
	const hasCtrlShift = hasOnlyCtrl && event.shiftKey;
	const hasCtrlAlt = event.ctrlKey && event.altKey && !event.metaKey;

	if (
		(hasOnlyCtrl && !event.shiftKey && key === SHORTCUTS.saveKey) ||
		(hasCtrlAlt && key === SHORTCUTS.saveKey)
	) {
		void saveCanvas();
		event.preventDefault();
		event.stopPropagation();
		return;
	}

	if (hasOnlyCtrl && !event.shiftKey) {
		if (SHORTCUTS.brushLargerKeys.has(event.key)) {
			increaseBrushSize();
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (SHORTCUTS.brushSmallerKeys.has(event.key)) {
			decreaseBrushSize();
			event.preventDefault();
			event.stopPropagation();
			return;
		}
	}

	if (isEditableTarget(event.target)) {
		return;
	}

	if (hasCtrlShift) {
		const shortcutTool =
			SHORTCUTS.toolCodes[event.code as keyof typeof SHORTCUTS.toolCodes];
		if (shortcutTool) {
			tool = shortcutTool;
			event.preventDefault();
			return;
		}
	}

	if (hasCtrlShift && key === SHORTCUTS.redoKey) {
		redo();
		event.preventDefault();
		return;
	}

	if (hasOnlyCtrl && !event.shiftKey && key === SHORTCUTS.undoKey) {
		undo();
		event.preventDefault();
		return;
	}
}

async function copyJson() {
	await navigator.clipboard.writeText(exportText);
	savedSnapshot = currentSnapshot;
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
		savedSnapshot = currentSnapshot;
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

function openColorPicker() {
	const rect = colorButton.getBoundingClientRect();
	colorInput.style.left = `${rect.left}px`;
	colorInput.style.top = `${rect.bottom + 12}px`;
	colorInput.click();
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

<svelte:window on:keydown={onKeydown} on:pointermove={resizeDebugPanel} on:pointerup={stopResizingDebugPanel} on:resize={fitView} />

<div class:embedded class="sketch-editor">
	<div class="toolbar">
		<div class="group">
			{#each TOOL_OPTIONS as option}
				<button
					class:active={tool === option.tool}
					class="icon-button"
					type="button"
					title={option.label}
					aria-label={option.label}
					on:click={() => (tool = option.tool)}
				>
					<Icon icon={option.icon} class="button-icon" />
				</button>
			{/each}
		</div>

		<div class="group">
			<button
				class="swatch active"
				style={`--swatch: ${color}`}
				type="button"
				title={`Current color ${color}`}
				aria-label={`Current color ${color}`}
				disabled
			></button>
			<button
				class="swatch"
				style={`--swatch: ${previousColor}`}
				type="button"
				title={`Previous color ${previousColor}`}
				aria-label={`Use previous color ${previousColor}`}
				on:click={() => setColor(previousColor)}
				></button>
				<button
					bind:this={colorButton}
					class="icon-button color-picker-button"
					type="button"
					title="Pick color"
				aria-label="Pick color"
				on:click={openColorPicker}
			>
				<Icon icon="material-symbols:palette-outline" class="button-icon" />
			</button>
			<input
				bind:this={colorInput}
				class="native-color-input"
				value={color}
				type="color"
				title="Pick color"
				aria-label="Pick color"
				on:input={(event) => setColor(event.currentTarget.value)}
			/>
		</div>

		<div class="control-grid">
			<label class="control-row">
				<span class="control-label">
					<Icon icon={getCurrentToolIcon()} class="button-icon" />
				</span>
				<span class="number-field">
					<input
						value={size}
						max={MAX_BRUSH_SIZE}
						min={MIN_BRUSH_SIZE}
						step="1"
						title="Brush size (Ctrl++ / Ctrl+-)"
						aria-label="Brush size"
						type="number"
						on:input={(event) =>
							setBrushSize((event.currentTarget as HTMLInputElement).valueAsNumber)}
					/>
					<span>px</span>
				</span>
				<input
					value={size}
					max={MAX_BRUSH_SIZE}
					min={MIN_BRUSH_SIZE}
					step="1"
					title="Brush size (Ctrl++ / Ctrl+-)"
					aria-label="Brush size"
					type="range"
					on:input={(event) =>
						setBrushSize((event.currentTarget as HTMLInputElement).valueAsNumber)}
				/>
			</label>
			<label class="control-row">
				<span class="control-label">
					<Icon icon={ZOOM_ICON} class="button-icon" />
				</span>
				<span class="number-field">
					<input
						value={Math.round(zoom * 100)}
						max={Math.round(MAX_ZOOM * 100)}
						min={Math.round(MIN_ZOOM * 100)}
						step="5"
						title="Zoom (Ctrl+wheel)"
						aria-label="Zoom"
						type="number"
						on:input={(event) =>
							setZoomPercent(
								(event.currentTarget as HTMLInputElement).valueAsNumber,
							)}
					/>
					<span>%</span>
				</span>
				<input
					value={zoom}
					max={MAX_ZOOM}
					min={MIN_ZOOM}
					step="0.05"
					title="Zoom (Ctrl+wheel)"
					aria-label="Zoom"
					type="range"
					on:input={(event) =>
						setZoom((event.currentTarget as HTMLInputElement).valueAsNumber)}
				/>
			</label>
		</div>

		<div class="group">
			<button
				class:dirty={isDirty}
				class="icon-button"
				type="button"
				title={sourcePath ? "Save canvas (Ctrl+S)" : "Copy canvas data (Ctrl+S)"}
				aria-label={sourcePath ? "Save canvas" : "Copy canvas data"}
				disabled={saving}
				on:click={saveCanvas}
			>
				<Icon icon={sourcePath ? "material-symbols:save-outline-rounded" : "material-symbols:content-copy-outline-rounded"} class="button-icon" />
			</button>
			<button class="icon-button" type="button" title="Undo (Ctrl+Z)" aria-label="Undo" on:click={undo}>
				<Icon icon="material-symbols:undo-rounded" class="button-icon" />
			</button>
			<button class="icon-button" type="button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" on:click={redo}>
				<Icon icon="material-symbols:redo-rounded" class="button-icon" />
			</button>
			<button class="icon-button danger" type="button" title="Clear canvas" aria-label="Clear canvas" on:click={clearCanvas}>
				<Icon icon="material-symbols:delete-outline-rounded" class="button-icon" />
			</button>
		</div>
	</div>

		<div class="canvas-stage">
			<canvas
				bind:this={canvas}
				on:wheel|nonpassive={zoomByWheel}
				on:pointerdown={onPointerDown}
				on:pointermove={onPointerMove}
				on:pointerup={onPointerUp}
				on:pointercancel={onPointerUp}
				on:pointerleave={onPointerLeave}
			></canvas>
			{#if pointerPreview && tool !== "pan"}
				<div
					class:eraser-preview={tool === "eraser"}
					class="brush-preview"
					style={`--preview-x: ${pointerPreview.x}px; --preview-y: ${pointerPreview.y}px; --preview-size: ${getActiveBrushSize() * zoom}px; --preview-color: ${tool === "eraser" ? "#0f172a" : color};`}
				></div>
			{/if}
	</div>

	<div class="statusbar">
		<button
			class:active={showAdvanced}
			class="status-icon-button"
			type="button"
			title={showAdvanced ? "Hide debug panel" : "Show debug panel"}
			aria-label={showAdvanced ? "Hide debug panel" : "Show debug panel"}
			on:click={() => (showAdvanced = !showAdvanced)}
		>
			<Icon icon="material-symbols:terminal-rounded" class="button-icon" />
		</button>
		<span aria-live="polite">
			{#if message}
				{message}
			{:else if saving}
				Saving...
			{:else if isDirty}
				Unsaved
			{:else}
				Saved
			{/if}
		</span>
	</div>

	{#if showAdvanced}
		<div class="io" style={`--debug-panel-height: ${debugPanelHeight}px;`}>
			<button
				class="debug-resize-handle"
				type="button"
				title="Resize debug panel"
				aria-label="Resize debug panel"
				on:pointerdown={startResizingDebugPanel}
			></button>
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
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 0.75rem;
		min-height: 100vh;
		overflow: hidden;
		padding: 1rem;
		background: #e2e8f0;
		color: #0f172a;
	}

	.sketch-editor.embedded {
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 0;
		border: 0;
		background: transparent;
	}

	.toolbar,
	.io-actions,
	.statusbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.statusbar {
		justify-content: space-between;
		min-height: 1.75rem;
		padding: 0 0.25rem;
		color: #475569;
		font-size: 0.8125rem;
	}

	.toolbar {
		padding-right: 3.75rem;
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

	.control-grid {
		display: grid;
		min-width: min(100%, 25rem);
		gap: 0.25rem;
		padding: 0.15rem 0.35rem;
	}

	.control-row {
		display: grid;
		grid-template-columns: 1.25rem 5.35rem minmax(8rem, 1fr);
		gap: 0.25rem;
		align-items: center;
		min-height: 1.9rem;
	}

	.control-label,
	.number-field {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
	}

	.control-label {
		justify-content: center;
		min-width: 0;
		color: #0f172a;
		font-weight: 650;
	}

	.number-field {
		display: grid;
		grid-template-columns: 3.5rem 1.1rem;
		gap: 0.25rem;
		justify-content: flex-end;
		align-items: center;
		color: #475569;
		font-size: 0.875rem;
	}

	.number-field input {
		width: 3.5rem;
		min-height: 1.7rem;
		padding: 0 0.25rem;
	}

	.control-row input[type="range"] {
		width: 100%;
		min-width: 8rem;
		min-height: 1.7rem;
	}

	button,
	select,
	input {
		min-height: 2rem;
		border: 1px solid #94a3b8;
		border-radius: 6px;
		background: #ffffff;
		color: #0f172a;
		font: inherit;
	}

	button {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		justify-content: center;
		padding: 0 0.75rem;
		cursor: pointer;
	}

	.icon-button {
		width: 2.25rem;
		min-width: 2.25rem;
		padding: 0;
	}

	.color-picker-button {
		border-color: #94a3b8;
		background: #ffffff;
		color: #0f172a;
	}

	:global(.button-icon) {
		width: 1.15rem;
		height: 1.15rem;
	}

	button.active {
		border-color: #7c3aed;
		background: #ede9fe;
	}

	button.dirty {
		border-color: #7c3aed;
		color: #7c3aed;
	}

	button.primary-action {
		border-color: #7c3aed;
		background: #7c3aed;
		color: #ffffff;
		font-weight: 700;
	}

	button.danger {
		color: #dc2626;
	}

	.status-icon-button {
		width: 1.6rem;
		min-width: 1.6rem;
		min-height: 1.6rem;
		padding: 0;
		border-color: transparent;
		background: transparent;
		color: #64748b;
	}

	.status-icon-button:hover,
	.status-icon-button.active {
		border-color: #cbd5e1;
		background: #ffffff;
		color: #0f172a;
	}

	.swatch {
		width: 2rem;
		min-width: 2rem;
		padding: 0;
		background: var(--swatch);
	}

	.swatch:disabled {
		cursor: default;
		opacity: 1;
	}

	.native-color-input {
		position: fixed;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		opacity: 0;
		pointer-events: none;
	}

	label {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
	}

	.canvas-stage {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 32rem;
	}

	canvas {
		width: 100%;
		height: 100%;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #f8fafc;
		touch-action: none;
	}

	.sketch-editor.embedded .canvas-stage {
		min-height: 0;
	}

	.brush-preview {
		position: absolute;
		left: var(--preview-x);
		top: var(--preview-y);
		width: max(var(--preview-size), 4px);
		height: max(var(--preview-size), 4px);
		border: 1.5px solid var(--preview-color);
		border-radius: 999px;
		background: color-mix(in srgb, var(--preview-color) 12%, transparent);
		box-shadow: 0 0 0 1px rgb(255 255 255 / 75%);
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.brush-preview.eraser-preview {
		border-style: dashed;
		background: rgb(255 255 255 / 45%);
	}

	.io {
		position: absolute;
		right: 1rem;
		bottom: 3rem;
		left: 1rem;
		z-index: 10;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.5rem;
		height: var(--debug-panel-height);
		min-height: 0;
		max-height: calc(100% - 7rem);
		overflow: hidden;
		padding: 0.75rem;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		background: #f8fafc;
		box-shadow: 0 -8px 24px rgb(15 23 42 / 12%);
	}

	.debug-resize-handle {
		position: absolute;
		top: -0.35rem;
		left: 0;
		width: 100%;
		min-height: 0.7rem;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: ns-resize;
	}

	.debug-resize-handle::before {
		position: absolute;
		top: 0.3rem;
		left: 0;
		width: 100%;
		height: 1px;
		background: #94a3b8;
		content: "";
	}

	textarea {
		width: 100%;
		height: 100%;
		min-height: 8rem;
		overflow: auto;
		padding: 0.75rem;
		border: 1px solid #94a3b8;
		border-radius: 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}
</style>
