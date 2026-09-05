import { visit } from "unist-util-visit";

export function remarkCommitTrail() {
	return (tree) => {
		visit(tree, "containerDirective", (node) => {
			if (node.name !== "commit-trail") return;

			const title =
				typeof node.attributes?.title === "string" &&
				node.attributes.title.trim()
					? node.attributes.title.trim()
					: "Implementation trail";

			node.data ??= {};
			node.data.hName = "details";
			node.data.hProperties = { className: ["commit-trail"] };
			node.children.unshift({
				type: "paragraph",
				data: { hName: "summary" },
				children: [{ type: "text", value: title }],
			});
		});
	};
}
