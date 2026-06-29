export type Tool = "pen" | "highlight" | "eraser" | "pan";

export const TOOL_OPTIONS: Array<{ tool: Tool; icon: string; label: string }> =
	[
		{
			tool: "pen",
			icon: "material-symbols:stylus-note-outline-rounded",
			label: "Pen (Ctrl+Shift+1)",
		},
		{
			tool: "highlight",
			icon: "material-symbols:ink-highlighter-outline-rounded",
			label: "Highlighter (Ctrl+Shift+2)",
		},
		{
			tool: "eraser",
			icon: "material-symbols:ink-eraser-outline-rounded",
			label: "Eraser (Ctrl+Shift+3)",
		},
		{
			tool: "pan",
			icon: "material-symbols:pan-tool-outline-rounded",
			label: "Pan (Ctrl+Shift+4)",
		},
	];

export const ZOOM_ICON = "material-symbols:zoom-in-rounded";

export type ShortcutConfig = {
	brushLargerKeys: ReadonlySet<string>;
	brushSmallerKeys: ReadonlySet<string>;
	redoKey: string;
	saveKey: string;
	undoKey: string;
	toolCodes: Record<string, Tool>;
};

export const SHORTCUTS: ShortcutConfig = {
	brushLargerKeys: new Set(["+", "="]),
	brushSmallerKeys: new Set(["-", "_"]),
	redoKey: "z",
	saveKey: "s",
	undoKey: "z",
	toolCodes: {
		Digit1: "pen",
		Digit2: "highlight",
		Digit3: "eraser",
		Digit4: "pan",
	},
};
