import { visit } from "unist-util-visit";

function encodeMermaid(value) {
	return encodeURIComponent(value).replace(/'/g, "%27");
}

export function remarkMermaid() {
	return (tree) => {
		visit(tree, "code", (node) => {
			if (node.lang !== "mermaid") {
				return;
			}

			node.type = "html";
			node.value = `<figure class="mermaid-pixel-frame" data-pagefind-ignore><div class="mermaid-diagram" data-mermaid='${encodeMermaid(node.value)}'></div></figure>`;
			delete node.lang;
			delete node.meta;
		});
	};
}
