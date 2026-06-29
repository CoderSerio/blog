<script lang="ts">
import "./sketch-block-dev.css";
import { mount } from "svelte";
import { type SketchDocument, validateSketch } from "../schema";
import { renderSketchToSvg } from "../svg";
import SketchEditor from "./SketchEditor.svelte";

type MountedEditor = ReturnType<typeof mount>;

const mountedEditors = new WeakMap<HTMLElement, MountedEditor>();
const dirtyEditors = new WeakMap<HTMLElement, boolean>();
let activeModal: HTMLElement | null = null;

type SketchLoadResult = {
	document: SketchDocument;
	imageUrl?: string;
};

function svgDataUrl(document: SketchDocument) {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
		renderSketchToSvg(document),
	)}`;
}

function updateFrameDocument(
	frame: HTMLElement,
	document: SketchDocument,
	imageUrl?: string,
) {
	const nextDocument = validateSketch(document);
	const image = frame.querySelector<HTMLImageElement>("img");
	frame.dataset.sketchSource = JSON.stringify(nextDocument);
	if (image) {
		image.src = imageUrl ?? svgDataUrl(nextDocument);
		image.width = nextDocument.width;
		image.height = nextDocument.height;
	}
}

async function loadLatestDocument(
	frame: HTMLElement,
): Promise<SketchLoadResult> {
	const sourcePath = frame.dataset.sketchPath ?? "";
	if (!sourcePath) {
		const document = validateSketch(
			JSON.parse(frame.dataset.sketchSource ?? ""),
		);
		return { document };
	}

	const response = await fetch(
		`/__sketch/document?path=${encodeURIComponent(sourcePath)}`,
	);
	const result = await response.json();
	if (!response.ok) {
		throw new Error(result.error ?? "Failed to load canvas");
	}

	const document = validateSketch(result.document);
	const imageUrl =
		typeof result.imageUrl === "string" ? result.imageUrl : undefined;
	updateFrameDocument(frame, document, imageUrl);
	return { document, imageUrl };
}

function closeActiveModal() {
	if (!activeModal) {
		return;
	}

	const editor = activeModal.querySelector<HTMLElement>(".sketch-dev-editor");
	if (
		editor &&
		dirtyEditors.get(editor) &&
		!window.confirm("Canvas has unsaved changes. Close without saving?")
	) {
		return;
	}

	activeModal.hidden = true;
	document.body.classList.remove("sketch-modal-open");
	activeModal = null;
}

function setupDevSketchBlocks() {
	for (const frame of document.querySelectorAll<HTMLElement>(
		".sketch-dev-frame",
	)) {
		const button = frame.querySelector<HTMLButtonElement>(
			".sketch-edit-button",
		);
		const modal = frame.querySelector<HTMLElement>(".sketch-dev-modal");
		const container = frame.querySelector<HTMLElement>(".sketch-dev-editor");
		const closeButton =
			frame.querySelector<HTMLButtonElement>(".sketch-dev-close");

		if (!button || !modal || !container || button.dataset.bound === "true") {
			continue;
		}

		button.dataset.bound = "true";
		if (modal.parentElement !== document.body) {
			document.body.append(modal);
		}
		void loadLatestDocument(frame).catch((error) => {
			console.error(error);
		});

		button.addEventListener("click", async () => {
			let source = frame.dataset.sketchSource ?? "";
			const sourcePath = frame.dataset.sketchPath ?? "";

			try {
				const latest = await loadLatestDocument(frame);
				source = JSON.stringify(latest.document);
			} catch (error) {
				console.error(error);
			}

			closeActiveModal();
			modal.hidden = false;
			activeModal = modal;
			document.body.classList.add("sketch-modal-open");

			if (mountedEditors.has(container)) {
				return;
			}

			mountedEditors.set(
				container,
				mount(SketchEditor, {
					target: container,
					props: {
						initialJson: source,
						embedded: true,
						sourcePath,
						onDocumentChange: (document: SketchDocument) => {
							updateFrameDocument(frame, document);
						},
						onSaved: ({
							document,
							imageUrl,
						}: {
							document: SketchDocument;
							imageUrl?: string;
						}) => {
							updateFrameDocument(frame, document, imageUrl);
						},
						onDirtyChange: (dirty: boolean) => {
							dirtyEditors.set(container, dirty);
						},
					},
				}),
			);
		});

		closeButton?.addEventListener("click", closeActiveModal);
		modal.addEventListener("click", (event) => {
			if (event.target === modal) {
				closeActiveModal();
			}
		});
	}
}

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape") {
		closeActiveModal();
	}
});

setupDevSketchBlocks();
document.addEventListener("astro:page-load", setupDevSketchBlocks);

const setupSwup = () => {
	window.swup.hooks.on("page:view", setupDevSketchBlocks);
};

if (window.swup) {
	setupSwup();
} else {
	document.addEventListener("swup:enable", setupSwup, { once: true });
}
</script>
